#!/usr/bin/env node
import { mkdtempSync, rmSync, readFileSync, lstatSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { development, ROOT } from "./lib/dev.mjs";
import { prompts } from "./lib/prompts.mjs";
import { locations, read, object, json, quote, hash, loadManifest, saveManifest, backupName, writeGlobal, preview } from "./lib/claude-files.mjs";

function flags(){const args=process.argv.slice(2);if(args.includes("--help")){console.log("Usage: npm run install:claude -- [--dry-run | --check] [--yes]\nPreview each global file. Approve each write. Back up each file before writing.\nUse --check to report drift without writing. Use --yes to approve all proposed files.");return null;}if(args.some(a=>!["--dry-run","--check","--yes"].includes(a))||args.includes("--dry-run")&&args.includes("--check"))throw new Error("Use --dry-run, --check, --yes, or --help.");return{dry:args.includes("--dry-run"),check:args.includes("--check"),yes:args.includes("--yes")};}
function register(args,expected){
  const stage=mkdtempSync(join(tmpdir(),"helm-claude-register-"));
  const env={...process.env,HOME:stage,CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC:"1"};
  for(const key of ["CLAUDE_CONFIG_DIR","ANTHROPIC_API_KEY","ANTHROPIC_AUTH_TOKEN","CLAUDE_CODE_OAUTH_TOKEN"])delete env[key];
  try{
    const result=spawnSync("claude",args,{env,cwd:stage,encoding:"utf8",timeout:30000,maxBuffer:1024*1024});
    if(result.error||result.status!==0)throw new Error("Claude MCP registration failed in the staging home. Check the Claude CLI installation.");
    const actual=object(read(join(stage,".claude.json"))).mcpServers?.helm;
    if(JSON.stringify(actual)!==JSON.stringify(expected))throw new Error("The Claude CLI produced an unexpected MCP entry.");
  }finally{rmSync(stage,{recursive:true,force:true});}
}
async function main(){
  const mode=flags();if(!mode)return;
  const loc=locations(),dev=development(),apiKey=process.env.HELM_API_KEY||dev.getKey();
  const client=new ConvexHttpClient(dev.url,{logger:false});
  let settings;try{settings=await client.query(makeFunctionReference("settings:get"),{apiKey});}catch{throw new Error("Read development settings before installing. Check the API key and deployment access.");}
  const manifest=loadManifest(loc),actions=[];
  const add=(path,after,details,beforeWrite)=>{loc.safe(path);const before=read(path);if(before!==after)actions.push({path,before,after,details,beforeWrite,backup:backupName(path)});};
  const mcpArgs=["mcp","add","helm","--scope","user","-e",`HELM_CONVEX_URL=${dev.url}`,"-e",`HELM_API_KEY=${apiKey}`,"--",process.execPath,join(ROOT,"mcp/helm-mcp.mjs")];
  const server={type:"stdio",command:process.execPath,args:[join(ROOT,"mcp/helm-mcp.mjs")],env:{HELM_CONVEX_URL:dev.url,HELM_API_KEY:apiKey}};
  loc.safe(loc.mcp);const config=object(read(loc.mcp));
  if(config.mcpServers!==undefined&&(!config.mcpServers||typeof config.mcpServers!=="object"||Array.isArray(config.mcpServers)))throw new Error("Use an object for mcpServers.");
  const maskedCommand=["claude",...mcpArgs.map(a=>a===`HELM_API_KEY=${apiKey}`?"HELM_API_KEY=[redacted]":a)].map(quote).join(" ");
  if(JSON.stringify(config.mcpServers?.helm)!==JSON.stringify(server))add(loc.mcp,json({...config,mcpServers:{...config.mcpServers,helm:server}}),"Register Helm MCP:\n"+maskedCommand+"\nRun this command in a temporary home. Merge only its Helm entry into this file.",()=>register(mcpArgs,server));
  for(const name of ["brief","capture","sweep","reconcile"]){const text=readFileSync(join(ROOT,".claude/skills",name,"SKILL.md"),"utf8").replace(new RegExp(`^name: ${name}$`,"m"),`name: helm-${name}`);add(join(loc.config,"skills","helm-"+name,"SKILL.md"),text,`Install /helm-${name}. Keep the unprefixed repository skill.`);}
  if(settings.hook.logSessions){
    const path=join(loc.config,"settings.json");loc.safe(path);const current=object(read(path));
    if(current.hooks!==undefined&&(!current.hooks||typeof current.hooks!=="object"||Array.isArray(current.hooks)))throw new Error("Use an object for hooks.");
    const previous=current.hooks?.SessionEnd??[];if(!Array.isArray(previous))throw new Error("Use an array for SessionEnd hooks.");
    const command=["env",`HELM_CONVEX_URL=${dev.url}`,`HELM_API_KEY=${apiKey}`,process.execPath,join(ROOT,"hooks/session-end.mjs")].map(quote).join(" ")+" # helm:session-end";
    const owned=entry=>Array.isArray(entry.hooks)&&entry.hooks.some(h=>h.type==="command"&&typeof h.command==="string"&&h.command.endsWith(" # helm:session-end"));
    const entry={matcher:"",hooks:[{type:"command",command,timeout:6}]};
    const kept=previous.flatMap(item=>owned(item)?[{...item,hooks:item.hooks.filter(h=>!(h.type==="command"&&typeof h.command==="string"&&h.command.endsWith(" # helm:session-end")))}].filter(item=>item.hooks.length):[item]);
    const hooks={...current.hooks,SessionEnd:[...kept,entry]};
    if(JSON.stringify(current.hooks)!==JSON.stringify(hooks))add(path,json({...current,hooks}),"Install the enabled SessionEnd hook. Store its API key in this file.\n"+json({hooks:{SessionEnd:[{matcher:"",hooks:[{type:"command",command:command.replaceAll(apiKey,"[redacted]"),timeout:6}]}]}}));
  }else console.log("Session logging is disabled. Skip the hook file entirely.");
  const ambientPath=join(loc.config,"CLAUDE.md");loc.safe(ambientPath);const ambient=read(ambientPath)??"",snippet=readFileSync(join(ROOT,"templates/claude/ambient-capture.md"),"utf8");
  const begin="<!-- helm:ambient-capture:start -->",end="<!-- helm:ambient-capture:end -->";
  const count=(text,part)=>text.split(part).length-1;
  if(count(ambient,begin)!==count(ambient,end)||count(ambient,begin)>1||ambient.indexOf(end)<ambient.indexOf(begin))throw new Error("Repair the Helm capture markers before installing.");
  const next=ambient.includes(begin)?ambient.slice(0,ambient.indexOf(begin))+snippet.trimEnd()+ambient.slice(ambient.indexOf(end)+end.length):ambient+(ambient&&!ambient.endsWith("\n")?"\n":"")+(ambient?"\n":"")+snippet;
  add(ambientPath,next,"Append the Helm ambient-capture rule. Preserve other instructions.");
  console.log("Scheduled routines use your enabled connectors and your Claude plan. These files are templates. Set the schedule in Claude Code.");
  for(const name of ["sweep","reconcile"])add(join(loc.config,"scheduled-tasks","helm-"+name,"SKILL.md"),readFileSync(join(ROOT,"templates/claude/scheduled-tasks","helm-"+name,"SKILL.md"),"utf8"),`Install the ${name} schedule template. Do not create a scheduled job.`);
  console.log(`Repository record: ${loc.manifest}\nDeployment writes: none. Run setup to change deployment configuration.`);
  if(mode.check){for(const item of actions)console.log("Drift: "+item.path);console.log(actions.length?`${actions.length} file(s) differ.`:"Claude integration matches the repository and development settings.");process.exitCode=actions.length?1:0;return;}
  const p=prompts({defaultsOnly:mode.yes||mode.dry});let writes=0;
  try{for(const item of actions){
    preview(item.path,item.before,item.after,item.backup,[apiKey]);console.log(item.details);
    const old=manifest.entries.find(e=>e.path===item.path);
    if(old&&hash(item.before)!==old.installedHash)throw new Error("An installed file changed outside this installer. Preserve the edits and reconcile that file before updating it.");
    if(mode.dry){console.log("Dry run. No write.");continue;}
    if(!mode.yes&&!await p.confirm("Write this file and its backup? [y/N]")){console.log("Skip this file.");continue;}
    if(mode.yes)console.log("Approved by --yes.");
    if(read(item.path)!==item.before)throw new Error("Configuration changed after the preview. Run the command again.");
    if(item.beforeWrite)item.beforeWrite();
    const entry=old??{path:item.path,originalBackup:item.backup,originalHash:hash(item.before),originalMode:item.before===null?0o600:lstatSync(item.path).mode&0o777};
    const previousHash=entry.installedHash;entry.installedHash=hash(item.after);
    if(!old)manifest.entries.push(entry);
    try{writeGlobal(loc,item.path,item.before,item.after,item.backup,{beforeReplace:()=>saveManifest(loc,manifest)});}catch(error){if(read(item.path)===item.before){if(old)entry.installedHash=previousHash;else manifest.entries=manifest.entries.filter(e=>e!==entry);saveManifest(loc,manifest);}throw error;}
    writes++;console.log("Installed. Backup retained.");
  }}finally{p.close();}
  console.log(mode.dry?"Dry run complete. No files or deployment values were written.":`Installation complete. Updated ${writes} file(s). Restart Claude Code after changes.`);
}
main().catch(error=>{const safe=/^(Use |Keep |Refuse |A global |The installation record |Configuration changed|Claude MCP registration failed|The Claude CLI produced|Read development settings|Repair the Helm|An installed file)/.test(error.message);console.error("Install failed: "+(safe?error.message:"Check configuration files, permissions, and the Claude CLI. Approved files may already be installed; re-run to resume."));process.exitCode=1;});
