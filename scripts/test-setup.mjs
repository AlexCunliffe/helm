/** End-to-end wizard acceptance on the configured development project. */
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { development } from "./lib/dev.mjs";
import { setSecret } from "./lib/keys.mjs";
const dev=development(),dir=mkdtempSync(join(tmpdir(),"helm-setup-")),file=join(dir,"answers.json");
const snapshot=()=>JSON.parse(dev.cli(["run","setup:snapshot","{}"]));
const saved=snapshot(),apiKey=dev.getKey(),surface=dev.cli(["env","get","HELM_SURFACE_TOKEN"]),anon=dev.cli(["env","get","HELM_ALLOW_ANON"]);
const suffix=randomUUID().slice(0,8),keys=["test-setup-work-"+suffix,"test-setup-home-"+suffix];
const answers={owner:{name:"Sam Example",shortName:"Sam",tone:"Short and calm."},founderContext:"Plan tasks and reserve time for follow-ups.",timezone:"UTC",workday:{start:"09:00",end:"18:00",days:[1,2,3,4,5],eveningWatchFrom:null},caps:{focusMinutes:35},sources:[{key:"gcal",label:"Fixture calendar",kind:"calendar",enabled:true,mcpServer:"fixture-calendar",notes:"Read fixture events only."}],hook:{logSessions:false,includeCwd:false,titleChars:120},areas:keys.map((key,order)=>({key,label:order?"Home tasks":"Project tasks",color:order?"#456789":"#345678",order}))};
writeFileSync(file,JSON.stringify(answers));
const outputs=[];
const run=(args,input)=>{const result=spawnSync(process.execPath,[join(dev.root,"scripts/setup.mjs"),...args],{cwd:dev.root,env:dev.env,input,encoding:"utf8",maxBuffer:4*1024*1024});outputs.push(result.stdout??"",result.stderr??"");return result;};
const allKeys=[apiKey,surface];
const compare=()=>({settings:snapshot().settings,areas:snapshot().areas,api:dev.getKey(),surface:dev.cli(["env","get","HELM_SURFACE_TOKEN"])});
const before=compare(),envFile=readFileSync(dev.envFile,"utf8");
try{
 assert.equal(run(["--from",file,"--dry-run"]).status,0);
 assert.ok(JSON.stringify(compare())===JSON.stringify(before),"dry-run preserves data and credentials");
 assert.ok(readFileSync(dev.envFile,"utf8")===envFile,"dry-run preserves local configuration");
 const declined=run(["--from",file],"n\nn\nn\nn\nn\nn\n");assert.equal(declined.status,0);
 assert.ok(JSON.stringify(compare())===JSON.stringify(before),"six declined steps make no writes");
 const invalid=join(dir,"invalid.json");writeFileSync(invalid,JSON.stringify({...answers,timezone:"invalid/zone"}));
 assert.ok(run(["--from",invalid,"--yes"]).status!==0);
 assert.ok(JSON.stringify(compare())===JSON.stringify(before),"invalid answers fail before writes");
 const secretFile=join(dir,"unsupported.json");writeFileSync(secretFile,JSON.stringify({anthropicApiKey:"fixture-only-not-a-key"}));
 assert.ok(run(["--from",secretFile,"--yes"]).status!==0);
 assert.ok(!outputs.join("").includes("fixture-only-not-a-key"),"secret fields are rejected before preview");
 const nested=join(dir,"nested.json");writeFileSync(nested,JSON.stringify({owner:{password:"fixture-hidden-value"}}));
 assert.ok(run(["--from",nested,"--yes"]).status!==0);assert.ok(!outputs.join("").includes("fixture-hidden-value"),"nested secret fields are rejected before preview");
 const one=run(["--from",file],"y\nn\nn\nn\nn\nn\n");assert.equal(one.status,0);
 const partial=snapshot();assert.equal(partial.settings.owner.shortName,"Sam");
 assert.ok(partial.settings.timezone===saved.settings.timezone&&JSON.stringify(partial.areas)===JSON.stringify(saved.areas),"declined time and areas stay unchanged");
 const resetClient=new ConvexHttpClient(dev.url,{logger:false});await resetClient.mutation(makeFunctionReference("settings:update"),{apiKey,patch:{owner:saved.settings.owner}});
 dev.cli(["env","remove","HELM_API_KEY"]);dev.cli(["env","remove","HELM_SURFACE_TOKEN"]);
 assert.equal(run(["--from",file,"--dry-run"]).status,0);
 assert.ok(!dev.cli(["env","get","HELM_API_KEY"])&&!dev.cli(["env","get","HELM_SURFACE_TOKEN"]),"dry-run does not mint missing keys");
 const applied=run(["--from",file,"--yes"]);assert.ok(applied.status===0,"wizard applies approved answers with no initial credentials");
 const newApi=dev.getKey(),newSurface=dev.cli(["env","get","HELM_SURFACE_TOKEN"]);allKeys.push(newApi,newSurface);
 assert.ok(/^[0-9a-f]{48}$/.test(newApi)&&/^[0-9a-f]{48}$/.test(newSurface)&&newApi!==newSurface,"wizard mints independent keys");
 const configured=snapshot();assert.equal(configured.settings.timezone,"UTC");assert.equal(configured.settings.owner.shortName,"Sam");assert.equal(configured.settings.caps.focusMinutes,35);
 assert.ok(configured.areas.filter(a=>!a.archived).every(a=>keys.includes(a.key)),"custom area set applied");
 assert.equal(run(["--from",file,"--yes"]).status,0);
 assert.ok(dev.getKey()===newApi&&dev.cli(["env","get","HELM_SURFACE_TOKEN"])===newSurface,"re-run preserves credentials");
 assert.ok(JSON.stringify(snapshot().areas)===JSON.stringify(configured.areas),"re-run preserves area row IDs and values");
 assert.ok(allKeys.filter(Boolean).every(key=>!outputs.join("").includes(key)),"wizard output contains no secrets");
 const suite=spawnSync("npm",["test"],{cwd:dev.root,env:dev.env,encoding:"utf8",maxBuffer:4*1024*1024});
 assert.ok(suite.status===0,"full regression passes with custom area keys");
 console.log("Wizard acceptance passed: six steps, decline, dry-run, validation, missing-key bootstrap, idempotence, no secret output, and full regression with custom areas.");
}finally{
 const failures=[];
 for(const action of [()=>setSecret(dev,"HELM_API_KEY",apiKey),()=>setSecret(dev,"HELM_SURFACE_TOKEN",surface),()=>anon?dev.cli(["env","set","HELM_ALLOW_ANON",anon]):dev.cli(["env","remove","HELM_ALLOW_ANON"])]){try{action();}catch{failures.push("credentials");}}
 try{
  const client=new ConvexHttpClient(dev.url,{logger:false});const m=(name,args)=>client.mutation(makeFunctionReference(name),{apiKey,...args});
  await m("settings:update",{patch:{...saved.settings,caps:null,workday:{...saved.settings.workday,eveningWatchFrom:saved.settings.workday.eveningWatchFrom??null}}});if(saved.settings.caps)await m("settings:update",{patch:{caps:saved.settings.caps}});
  for(const a of saved.areas){const {_id,_creationTime,...fields}=a;await m("areas:upsertArea",{...fields,archived:a.archived??false});}
  dev.cli(["run","testing:removeFixtureAreas",JSON.stringify({keys})]);
 }catch{failures.push("data");}
 rmSync(dir,{recursive:true,force:true});
 if(failures.length)throw new Error("Wizard test restoration failed. Inspect development state before continuing.");
}
