/** All Claude writes stay in fresh temporary homes. The real configuration is never opened. */
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync, existsSync, lstatSync, symlinkSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { development, ROOT } from "./lib/dev.mjs";
import { hash, json } from "./lib/claude-files.mjs";
const mcpRequire=createRequire(new URL("../mcp/package.json",import.meta.url));
const {Client}=await import(mcpRequire.resolve("@modelcontextprotocol/sdk/client/index.js"));
const {StdioClientTransport}=await import(mcpRequire.resolve("@modelcontextprotocol/sdk/client/stdio.js"));
const dev=development(),key=dev.getKey(),client=new ConvexHttpClient(dev.url,{logger:false});
const query=(name,args={})=>client.query(makeFunctionReference(name),{apiKey:key,...args});
const mutate=(name,args={})=>client.mutation(makeFunctionReference(name),{apiKey:key,...args});
const saved=await query("settings:get"),homes=[],records=[];
const oldSecret="fixture-existing-private-value";
function fixture({custom=false,empty=false}={}){
 const home=realpathSync(mkdtempSync(join(tmpdir(),"helm-install-test-")));homes.push(home);
 const config=join(home,custom?"claude-custom":".claude"),mcp=custom?join(config,".claude.json"):join(home,".claude.json");
 const env={...dev.env,HOME:home,HELM_API_KEY:key,CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC:"1"};delete env.CLAUDE_CONFIG_DIR;if(custom)env.CLAUDE_CONFIG_DIR=config;
 for(const name of ["ANTHROPIC_API_KEY","ANTHROPIC_AUTH_TOKEN","CLAUDE_CODE_OAUTH_TOKEN"])delete env[name];
 const record=join(ROOT,".helm-local/installs",hash(home+"\n"+config)+".json");records.push(record);
 const originals=new Map();
 const put=(path,text)=>{mkdirSync(join(path,".."),{recursive:true});writeFileSync(path,text,{mode:0o600});originals.set(path,text);};
 if(!empty){put(mcp,json({theme:"dark",mcpServers:{other:{command:"example",env:{CUSTOM_PASSWORD:oldSecret}}}}));put(join(config,"settings.json"),json({permissions:{allow:["Read"]},hooks:{SessionEnd:[{matcher:"",hooks:[{type:"command",command:"true # existing"}]}]}}));put(join(config,"CLAUDE.md"),"# Existing instructions\n\nKeep this line.\n");put(join(config,"skills/brief/SKILL.md"),"A personal brief skill.\n");put(join(config,"skills/helm-capture/SKILL.md"),"A previous capture template.\n");}
 return {home,config,mcp,env,record,originals};
}
function tree(dir){return Object.fromEntries(readdirSync(dir,{recursive:true}).sort().map(name=>{const path=join(dir,name),s=lstatSync(path);return[name,s.isDirectory()?"dir":s.isSymbolicLink()?"link":{text:readFileSync(path,"utf8"),mode:s.mode&0o777}];}));}
function run(f,script,args=[],input){const result=spawnSync(process.execPath,[join(ROOT,"scripts",script),...args],{cwd:ROOT,env:f.env,encoding:"utf8",input,timeout:90000,maxBuffer:4*1024*1024});assert.ok(!result.error,`${script} completes`);const output=result.stdout+result.stderr;assert.ok(!output.includes(key),"no live key in output");assert.ok(!output.includes(oldSecret),"no existing secret in output");return{status:result.status,output};}
try{
 await mutate("settings:update",{patch:{hook:{logSessions:false}}});
 const f=fixture(),before=tree(f.home);
 let r=run(f,"install-claude.mjs",["--dry-run"]);assert.equal(r.status,0,r.output);assert.ok(r.output.includes("Session logging is disabled"));assert.deepEqual(tree(f.home),before);assert.ok(!existsSync(f.record));
 r=run(f,"install-claude.mjs",["--check"]);assert.equal(r.status,1);assert.deepEqual(tree(f.home),before);assert.ok(!existsSync(f.record));
 r=run(f,"install-claude.mjs",[],"n\n".repeat(20));assert.equal(r.status,0,r.output);assert.deepEqual(tree(f.home),before);assert.ok(!existsSync(f.record));
 r=run(f,"install-claude.mjs",["--yes"]);assert.equal(r.status,0,r.output);assert.equal((r.output.match(/Approved by --yes/g)||[]).length,8);
 let registry=JSON.parse(readFileSync(f.mcp,"utf8"));assert.equal(registry.theme,"dark");assert.equal(registry.mcpServers.other.env.CUSTOM_PASSWORD,oldSecret);assert.deepEqual(Object.keys(registry).sort(),["mcpServers","theme"]);
 assert.equal(readFileSync(join(f.config,"settings.json"),"utf8"),f.originals.get(join(f.config,"settings.json")),"disabled hook file is untouched");
 assert.equal(readFileSync(join(f.config,"skills/brief/SKILL.md"),"utf8"),"A personal brief skill.\n");
 assert.match(readFileSync(join(f.config,"skills/helm-capture/SKILL.md"),"utf8"),/^name: helm-capture$/m);
 const record=JSON.parse(readFileSync(f.record,"utf8"));assert.equal(record.entries.length,8);assert.ok(!readFileSync(f.record,"utf8").includes(key));
 for(const entry of record.entries){assert.ok(existsSync(entry.originalBackup));assert.equal(lstatSync(entry.path).mode&0o777,0o600);assert.equal(lstatSync(entry.originalBackup).mode&0o777,0o600);}
 let installed=tree(f.home);r=run(f,"install-claude.mjs",["--check"]);assert.equal(r.status,0,r.output);assert.deepEqual(tree(f.home),installed);
 r=run(f,"install-claude.mjs",["--yes"]);assert.equal(r.status,0,r.output);assert.deepEqual(tree(f.home),installed,"re-run creates no backups or writes");
 const server=registry.mcpServers.helm,mcp=new Client({name:"helm-installer-test",version:"1.0.0"});const transport=new StdioClientTransport({command:server.command,args:server.args,env:{...f.env,...server.env},stderr:"pipe"});
 try{await mcp.connect(transport);for(const name of ["getSettings","brief"]){const result=await mcp.callTool({name,arguments:{}});assert.ok(!result.isError,`registered MCP ${name} succeeds`);}}finally{await mcp.close();}
 await mutate("settings:update",{patch:{hook:{logSessions:true}}});
 r=run(f,"install-claude.mjs",["--yes"]);assert.equal(r.status,0,r.output);assert.equal((r.output.match(/Approved by --yes/g)||[]).length,1);
 const settings=JSON.parse(readFileSync(join(f.config,"settings.json"),"utf8"));assert.deepEqual(settings.permissions,{allow:["Read"]});assert.equal(settings.hooks.SessionEnd.length,2);assert.equal(settings.hooks.SessionEnd[0].hooks[0].command,"true # existing");
 const hook=settings.hooks.SessionEnd[1].hooks[0];const hookResult=spawnSync("/bin/sh",["-c",hook.command],{input:"{}",env:f.env,encoding:"utf8",timeout:10000});assert.equal(hookResult.status,0);assert.equal(hookResult.stdout+hookResult.stderr,"");
 installed=tree(f.home);r=run(f,"uninstall-claude.mjs",["--dry-run"]);assert.equal(r.status,0,r.output);assert.deepEqual(tree(f.home),installed);
 r=run(f,"uninstall-claude.mjs",[],"n\n".repeat(20));assert.equal(r.status,0,r.output);assert.deepEqual(tree(f.home),installed);
 const drift=join(f.config,"skills/helm-brief/SKILL.md"),originalInstalled=readFileSync(drift,"utf8");writeFileSync(drift,originalInstalled+"\nLater user edit.\n");
 r=run(f,"install-claude.mjs",["--check"]);assert.equal(r.status,1);assert.ok(r.output.includes(drift));
 r=run(f,"uninstall-claude.mjs",["--yes"]);assert.equal(r.status,1);assert.ok(readFileSync(drift,"utf8").includes("Later user edit."));assert.equal(JSON.parse(readFileSync(f.record,"utf8")).entries.length,1);
 writeFileSync(drift,originalInstalled);r=run(f,"uninstall-claude.mjs",["--yes"]);assert.equal(r.status,0,r.output);assert.ok(!existsSync(drift));
 for(const [path,text]of f.originals)assert.equal(readFileSync(path,"utf8"),text,"uninstall restores original bytes");
 assert.deepEqual(JSON.parse(readFileSync(f.record,"utf8")).entries,[]);
 const custom=fixture({custom:true,empty:true});r=run(custom,"install-claude.mjs",["--yes"]);assert.equal(r.status,0,r.output);assert.ok(existsSync(custom.mcp));assert.ok(!existsSync(join(custom.home,".claude.json")));
 r=run(custom,"install-claude.mjs",["--check"]);assert.equal(r.status,0,r.output);r=run(custom,"uninstall-claude.mjs",["--yes"]);assert.equal(r.status,0,r.output);assert.ok(!existsSync(custom.mcp));
 const linked=fixture({empty:true}),outside=mkdtempSync(join(tmpdir(),"helm-outside-test-"));homes.push(outside);symlinkSync(outside,linked.config,"dir");r=run(linked,"install-claude.mjs",["--yes"]);assert.equal(r.status,1);assert.deepEqual(readdirSync(outside),[]);assert.ok(!existsSync(linked.mcp));assert.ok(!existsSync(linked.record));
 console.log("Claude installer acceptance passed: scratch homes only, real CLI registration and MCP reads, per-file approvals, decline, dry-run, drift check, disabled and enabled hooks, backups, idempotence, custom config path, symlink rejection, later-edit preservation, and original-file restoration.");
}catch(error){
 console.error("Installer acceptance failed: "+error.message.replaceAll(key,"[redacted]").replaceAll(oldSecret,"[redacted]"));process.exitCode=1;
}finally{
 await mutate("settings:update",{patch:{hook:saved.hook}});
 for(const record of records)rmSync(record,{force:true});for(const home of homes)rmSync(home,{recursive:true,force:true});
}
