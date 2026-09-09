#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { development } from "./lib/dev.mjs";
import { AREA_PRESETS, validateAreas } from "./lib/areas.mjs";
import { SOURCE_PRESETS } from "./lib/sources.mjs";
import { mintKey, setSecret } from "./lib/keys.mjs";
import { prompts } from "./lib/prompts.mjs";
import { seedAreas } from "./seed.mjs";

const clone=value=>JSON.parse(JSON.stringify(value));
function noSecrets(value){
  if(value&&typeof value==="object")for(const [key,child]of Object.entries(value)){
    if(/password|secret|token|api.?key/i.test(key))throw new Error("Keep secrets out of answer files and settings.");
    noSecrets(child);
  }
  const text=JSON.stringify(value);
  if(/sk-ant-[a-z0-9_-]{10,}|\b[0-9a-f]{48}\b/i.test(text)) throw new Error("Keep secrets out of answer files and settings.");
}
function answersFrom(file,current){
  const input=file?JSON.parse(readFileSync(file,"utf8")):{};
  const allowed=["owner","founderContext","timezone","workday","caps","sources","hook","areas","areaPreset"];
  if(!input||typeof input!=="object"||Array.isArray(input)||Object.keys(input).some(k=>!allowed.includes(k))) throw new Error("Use the documented non-secret answer fields.");
  noSecrets(input);
  for(const key of ["owner","workday","hook","caps"])if(input[key]!==undefined&&!(key==="caps"&&input[key]===null)&&(!input[key]||typeof input[key]!=="object"||Array.isArray(input[key])))throw new Error(`Use an object for ${key}.`);
  const settings={...clone(current.settings),...input};delete settings.areas;delete settings.areaPreset;
  for(const key of ["owner","workday","hook"])settings[key]={...current.settings[key],...input[key]};
  if(input.caps===null)delete settings.caps;
  else if(input.caps)settings.caps={...current.settings.caps,...input.caps};
  if(settings.workday.eveningWatchFrom===null)delete settings.workday.eveningWatchFrom;
  if(!current.hasSettings&&!input.timezone)settings.timezone=Intl.DateTimeFormat().resolvedOptions().timeZone;
  const preset=input.areaPreset??"generic";
  if(!AREA_PRESETS[preset])throw new Error("Use the generic or classic area preset.");
  const existing=current.areas.filter(a=>!a.archived).sort((a,b)=>a.order-b.order||a.key.localeCompare(b.key)).map(({key,label,color,order,vaultDomain})=>({key,label,color,order,...(vaultDomain?{vaultDomain}:{})}));
  const areas=input.areas??(input.areaPreset?clone(AREA_PRESETS[preset]):existing.length?existing:clone(AREA_PRESETS.generic));
  validateAreas(areas);noSecrets(settings);
  return {settings,areas};
}
async function main(){
  const args=process.argv.slice(2);let from,dryRun=false,yes=false;
  for(let i=0;i<args.length;i++){
    if(args[i]==="--help"){console.log("Usage: npm run setup -- [--from settings.local.json] [--yes] [--dry-run]\nConfigure six steps on the selected development deployment. Answer files contain no secrets.\nUse --yes with --from to approve all six steps. Dry-run makes no writes.");return;}
    if(args[i]==="--from"&&args[i+1])from=args[++i];else if(args[i]==="--dry-run")dryRun=true;else if(args[i]==="--yes")yes=true;else throw new Error("Use --from, --yes, --dry-run, or --help.");
  }
  if(yes&&!from)throw new Error("Use --from with --yes.");
  if(!from&&!dryRun&&!process.stdin.isTTY)throw new Error("Use an interactive terminal, or supply --from and --yes.");
  const dev=development();
  const snapshot=()=>JSON.parse(dev.cli(["run","setup:snapshot","{}"]));
  const before=snapshot(),answer=answersFrom(from,before),selected=clone(before.settings);
  let selectedAreas=before.areas.filter(a=>!a.archived).map(({key,label,color,order,vaultDomain})=>({key,label,color,order,...(vaultDomain?{vaultDomain}:{})}));
  const p=prompts({defaultsOnly:yes||(dryRun&&!process.stdin.isTTY)});
  const approved=[];let anthropicKey="",security=false;
  const interactive=!from&&process.stdin.isTTY;
  console.log(`Development deployment: ${dev.name}`);
  console.log("Review all six steps. Changes are applied after the approvals. Enter '-' to clear a text value.");
  async function review(number,title,preview,apply){
    console.log(`\n${number}. ${title}\n${typeof preview==="string"?preview:JSON.stringify(preview,null,2)}`);
    if(dryRun){console.log("Dry run. No write.");apply();return;}
    if(yes||await p.confirm(`Approve ${title.toLowerCase()}? [y/N]`)){approved.push(title);apply();if(yes)console.log("Approved by --yes.");}
    else console.log("Keep the current values.");
  }
  try{
    if(interactive)for(const key of ["name","shortName","role","business","tone"])answer.settings.owner[key]=await p.ask(`Enter ${key}`,answer.settings.owner[key]??"");
    noSecrets(answer.settings.owner);
    await review(1,"Owner",{writes:"settings.owner",value:answer.settings.owner},()=>selected.owner=answer.settings.owner);
    if(interactive)answer.settings.founderContext=await p.ask("Describe your usual week and what tends to slip",answer.settings.founderContext);
    noSecrets(answer.settings.founderContext);
    await review(2,"Context",{writes:"settings.founderContext",value:answer.settings.founderContext},()=>selected.founderContext=answer.settings.founderContext);
    if(interactive){
      answer.settings.timezone=await p.ask("Enter an IANA timezone",answer.settings.timezone);
      for(const key of ["start","end"])answer.settings.workday[key]=await p.ask(`Enter workday ${key} (HH:MM)`,answer.settings.workday[key]);
      answer.settings.workday.days=(await p.ask("Enter working days (1=Mon, 7=Sun; comma separated)",answer.settings.workday.days.join(","))).split(",").map(Number);
      const evening=await p.ask("Enter evening watch (HH:MM; '-' uses workday end)",answer.settings.workday.eveningWatchFrom??"");
      if(evening)answer.settings.workday.eveningWatchFrom=evening;else delete answer.settings.workday.eveningWatchFrom;
      if(await p.confirm("Edit optional display and timing limits? [y/N]")){
        const limits={today:3,wins:5,ageing:5,waiting:10,upcoming:5,newToday:50,waitingAgeingDays:5,openAgeingDays:14,meetingPrepLeadMin:30,focusMinutes:25};
        answer.settings.caps={...answer.settings.caps};for(const [key,fallback]of Object.entries(limits)){const value=await p.ask(`Enter ${key} (default ${fallback}; '-' clears override)`,String(answer.settings.caps[key]??""));if(value==="")delete answer.settings.caps[key];else answer.settings.caps[key]=Number(value);}
      }
    }
    await review(3,"Time",{writes:["settings.timezone","settings.workday","settings.caps"],timezone:answer.settings.timezone,workday:answer.settings.workday,caps:answer.settings.caps??{}},()=>{selected.timezone=answer.settings.timezone;selected.workday=answer.settings.workday;if(answer.settings.caps)selected.caps=answer.settings.caps;else delete selected.caps;});
    if(interactive){
      const preset=await p.ask("Use current, generic, or classic areas","current");if(preset!=="current"){if(!AREA_PRESETS[preset])throw new Error("Use current, generic, or classic.");answer.areas=clone(AREA_PRESETS[preset]);}
      const kept=[];for(const area of answer.areas){console.log(`${area.key}: ${area.label} (${area.color})`);if(await p.confirm(`Remove ${area.label}? [y/N]`))continue;area.label=await p.ask("Enter the area label",area.label);area.color=await p.ask("Enter a six-digit hex color",area.color);kept.push({...area});}
      while(await p.confirm("Add another area? [y/N]")){const order=Math.max(-1,...kept.map(area=>area.order))+1;if(order>10000)throw new Error("Use an answer file to lower area orders before appending another area.");kept.push({key:await p.ask("Enter a lowercase area key"),label:await p.ask("Enter the area label"),color:await p.ask("Enter a six-digit hex color","#5B8DEF"),order});}
      answer.areas=kept;
    }
    validateAreas(answer.areas);
    const retiring=before.areas.filter(a=>!a.archived&&!answer.areas.some(next=>next.key===a.key)).map(a=>a.key);
    await review(4,"Areas",{writes:"Seed empty areas; update selected areas; retire omitted active areas",areas:answer.areas,retire:retiring},()=>selectedAreas=answer.areas);
    if(interactive){
      console.log("Known sources: "+SOURCE_PRESETS.map(s=>s.key).join(", "));
      const keys=(await p.ask("Enter source keys to enable (comma separated; '-' disables all)",answer.settings.sources.filter(s=>s.enabled).map(s=>s.key).join(","))).split(",").map(k=>k.trim()).filter(Boolean);
      const sources=answer.settings.sources.map(s=>({...s,enabled:keys.includes(s.key)}));
      for(const key of keys){let source=sources.find(s=>s.key===key);if(!source){source={...(SOURCE_PRESETS.find(s=>s.key===key)??{key,label:key,kind:"custom",notes:""}),enabled:true};sources.push(source);}source.label=await p.ask(`Enter the label for ${key}`,source.label);source.mcpServer=await p.ask(`Enter the MCP server name for ${key}`,source.mcpServer??"");source.notes=await p.ask(`Enter read rules for ${key}`,source.notes??"");}
      answer.settings.sources=sources;
    }
    noSecrets(answer.settings.sources);
    await review(5,"Sources",{writes:"settings.sources",value:answer.settings.sources},()=>selected.sources=answer.settings.sources);
    if(interactive){
      answer.settings.hook.logSessions=/^y(es)?$/i.test(await p.ask("Log completed Claude Code sessions? (y/n)",answer.settings.hook.logSessions?"y":"n"));
      answer.settings.hook.includeCwd=/^y(es)?$/i.test(await p.ask("Include the working directory in logged sessions? (y/n)",answer.settings.hook.includeCwd?"y":"n"));
      answer.settings.hook.titleChars=Number(await p.ask("Enter the maximum hook title length",String(answer.settings.hook.titleChars)));
      if(await p.confirm("Set an Anthropic API key now? [y/N]"))anthropicKey=await p.ask("Paste the Anthropic API key (hidden)","",{secret:true});
    }
    await review(6,"Security",{writes:[before.hasApiKey?"Keep HELM_API_KEY":"Mint HELM_API_KEY",before.hasSurfaceToken?"Keep HELM_SURFACE_TOKEN":"Mint HELM_SURFACE_TOKEN",anthropicKey?"Set ANTHROPIC_API_KEY":"Keep ANTHROPIC_API_KEY unchanged","Disable anonymous access","settings.hook"],hook:answer.settings.hook},()=>{security=true;selected.hook=answer.settings.hook;});
    if(!dryRun&&!approved.length){console.log("No changes were approved.");return;}
    noSecrets(selected);validateAreas(selectedAreas);
    dev.cli(["run","setup:validate",JSON.stringify({settings:selected,areas:selectedAreas})]);
    if(dryRun){console.log("\nDry run complete. No data, credentials, or files were written.");return;}
    const current=snapshot();
    if(JSON.stringify(current.settings)!==JSON.stringify(before.settings)||JSON.stringify(current.areas)!==JSON.stringify(before.areas))throw new Error("Configuration changed during setup. Run setup again.");
    if(!security&&(!current.hasApiKey||!current.hasSurfaceToken))throw new Error("Approve security to create the required credentials. No configuration was applied.");
    if(security){
      if(!current.hasApiKey)setSecret(dev,"HELM_API_KEY",mintKey());
      if(!current.hasSurfaceToken)setSecret(dev,"HELM_SURFACE_TOKEN",mintKey());
      if(anthropicKey)setSecret(dev,"ANTHROPIC_API_KEY",anthropicKey);
      dev.cli(["env","remove","HELM_ALLOW_ANON"]);
    }
    const apiKey=dev.getKey(),client=new ConvexHttpClient(dev.url,{logger:false});
    const mutation=(name,args)=>client.mutation(makeFunctionReference(name),{apiKey,...args});
    const caps=selected.caps?{...Object.fromEntries(Object.keys(before.settings.caps??{}).map(k=>[k,null])),...selected.caps}:null;
    const patch={};
    if(approved.includes("Owner"))patch.owner=selected.owner;
    if(approved.includes("Context"))patch.founderContext=selected.founderContext;
    if(approved.includes("Time")){patch.timezone=selected.timezone;patch.caps=caps;patch.workday={...selected.workday,eveningWatchFrom:selected.workday.eveningWatchFrom??null};}
    if(approved.includes("Sources"))patch.sources=selected.sources;
    if(approved.includes("Security"))patch.hook=selected.hook;
    if(Object.keys(patch).length)await mutation("settings:update",{patch});
    if(approved.includes("Areas")){if(!current.areas.length)await seedAreas({areas:selectedAreas,dev});
    else{
      for(const area of selectedAreas)await mutation("areas:upsertArea",{...area,archived:false});
      for(const area of current.areas.filter(a=>!a.archived&&!selectedAreas.some(s=>s.key===a.key)))await mutation("areas:upsertArea",{key:area.key,label:area.label,color:area.color,archived:true});
    }
    }
    console.log("\nSetup complete. Credentials stay in Convex. No secret was printed or written to disk.");
    console.log("Run npm test. Open "+dev.url.replace(".convex.cloud",".convex.site")+"/glass. Read HELM_API_KEY locally with npx convex env get HELM_API_KEY when you unlock the page.");
    if(!current.hasAnthropicKey&&!anthropicKey)console.log("Optional AI actions remain off until ANTHROPIC_API_KEY is set.");
  }finally{p.close();anthropicKey="";}
}
main().catch(error=>{console.error("Setup failed: "+(/^(Use |Keep |Input |Configuration changed|Approve security)/.test(error.message)?error.message:"Check the answer fields, development access, and connection. Approved writes may have completed; re-run setup to resume."));process.exitCode=1;});
