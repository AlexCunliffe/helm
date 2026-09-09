import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { development } from "./lib/dev.mjs";
import { hookFixtures, runHook } from "./hook-fixtures.mjs";
await hookFixtures();
const dev=development(),key=dev.getKey(),client=new ConvexHttpClient(dev.url,{logger:false});
const q=(name,args={})=>client.query(makeFunctionReference(name),{apiKey:key,...args});
const m=(name,args={})=>client.mutation(makeFunctionReference(name),{apiKey:key,...args});
const saved=await q("settings:get");
const dir=mkdtempSync(join(tmpdir(),"helm-hook-live-")),path=join(dir,"transcript.jsonl");
const session="test-hook-"+randomUUID(),prefix="session:"+session;
writeFileSync(path,JSON.stringify({type:"user",message:{content:"TEST hook completed a small review"}}));
const payload={session_id:session,transcript_path:path,cwd:"/tmp/example-work"};
const env={...dev.env,HELM_CONVEX_URL:dev.url,HELM_API_KEY:key};
try{
 await m("settings:update",{patch:{hook:{logSessions:false,includeCwd:false,titleChars:140}}});
 assert.deepEqual(await runHook(env,payload),{code:0,stdout:"",stderr:""});
 assert.ok(!(await q("queries:list",{status:"done",limit:200})).some(t=>t.dedupeKey===prefix),"default creates no completion");
 await m("settings:update",{patch:{hook:{logSessions:true,includeCwd:false,titleChars:17}}});
 assert.deepEqual(await runHook(env,payload),{code:0,stdout:"",stderr:""});
 const task=(await q("queries:list",{status:"done",limit:200})).find(t=>t.dedupeKey===prefix);
 assert.ok(task&&task.provisional&&task.title.length===17&&task.contextLine==="Claude Code session","enabled hook follows settings");
 assert.ok(!JSON.stringify(task).includes("/tmp/example-work"),"directory is omitted");
 assert.deepEqual(await runHook(env,payload),{code:0,stdout:"",stderr:""});
 assert.equal((await q("queries:list",{status:"done",limit:200})).filter(t=>t.dedupeKey===prefix).length,1,"repeated session dedupes");
 console.log("Development hook tests passed: default off, configured title length, no directory, provisional completion, and session dedupe.");
}finally{
 await m("settings:update",{patch:{hook:saved.hook}});
 dev.cli(["run","testing:purgeTestData",JSON.stringify({prefix,dates:[]})]);
 rmSync(dir,{recursive:true,force:true});
}
