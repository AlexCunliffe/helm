/** Hook fixtures use a loopback server and an isolated temp transcript. */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { ROOT } from "./lib/dev.mjs";
export function runHook(env, payload) {
  return new Promise((resolve, reject) => {
    const child=spawn(process.execPath,[join(ROOT,"hooks/session-end.mjs")],{env:{...process.env,HELM_HOOK_DISABLED:"",...env},stdio:["pipe","pipe","pipe"]});
    let stdout="",stderr="";
    const timeout=setTimeout(()=>{child.kill();reject(new Error("Hook exceeded shutdown deadline."));},6500);
    child.stdout.on("data",d=>stdout+=d);child.stderr.on("data",d=>stderr+=d);child.on("error",reject);
    child.on("close",code=>{clearTimeout(timeout);resolve({code,stdout,stderr});});
    child.stdin.on("error",()=>{});child.stdin.end(typeof payload==="string"?payload:JSON.stringify(payload));
  });
}
export async function hookFixtures(){
 const dir=mkdtempSync(join(tmpdir(),"helm-hook-")),path=join(dir,"transcript.jsonl");
 const cwd="/tmp/example-work",message="Review the draft plan and record the result";
 writeFileSync(path,JSON.stringify({type:"user",message:{content:[{type:"text",text:message}]}}));
 let hook={logSessions:false,includeCwd:false,titleChars:140},failure=false,hang=false;
 const calls=[];
 const server=createServer(async(req,res)=>{
  let text="";for await(const chunk of req)text+=chunk;
  const body=JSON.parse(text);calls.push(body);
  res.setHeader("Content-Type","application/json");
  if(hang)return;
  if(failure){res.statusCode=503;res.end('{}');return;}
  res.end(JSON.stringify({status:"success",value:req.url==="/api/query"?{hook}:{taskId:"fixture",created:true}}));
 });
 await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
 const env={HELM_CONVEX_URL:`http://127.0.0.1:${server.address().port}`,HELM_API_KEY:"fixture-key"};
 const payload={session_id:"test-hook-fixture",transcript_path:path,cwd};
 const run=async value=>{calls.length=0;const result=await runHook(env,value);assert.deepEqual(result,{code:0,stdout:"",stderr:""});return calls;};
 try{
  await run(payload);assert.ok(calls.length===1&&calls[0].path==="settings:get");
  assert.ok(!JSON.stringify(calls).includes(message)&&!JSON.stringify(calls).includes(cwd),"off sends no session content");
  hook={logSessions:true,includeCwd:false,titleChars:12};await run(payload);
  let mutation=calls.find(c=>c.path==="tasks:logCompletion");assert.equal(mutation.args.title,message.slice(0,12));
  assert.equal(mutation.args.contextLine,"Claude Code session");assert.ok(!JSON.stringify(calls).includes(cwd));
  hook.includeCwd=true;await run(payload);assert.ok(calls.find(c=>c.path==="tasks:logCompletion").args.contextLine.includes(cwd));
  await run({...payload,cwd:{invalid:true}});assert.equal(calls.find(c=>c.path==="tasks:logCompletion").args.contextLine,"Claude Code session");
  for(const bad of ["{",{},[],{...payload,session_id:42},"x".repeat(70000)]){await run(bad);assert.equal(calls.length,0);}
  for(const transcript_path of [dir,join(dir,"absent"),42]){await run({...payload,transcript_path});assert.ok(!calls.some(c=>c.path==="tasks:logCompletion"));}
  hook.titleChars=0;await run(payload);assert.ok(!calls.some(c=>c.path==="tasks:logCompletion"));
  hook.titleChars=12;failure=true;await run(payload);assert.equal(calls.length,1);
  failure=false;hang=true;await run(payload);assert.equal(calls.length,1);hang=false;
  const beforeDisabled=calls.length;
  const disabled=await runHook({...env,HELM_HOOK_DISABLED:"1"},payload);assert.deepEqual(disabled,{code:0,stdout:"",stderr:""});assert.equal(calls.length,beforeDisabled);
  const noKey=await runHook({...env,HELM_API_KEY:""},payload);assert.deepEqual(noKey,{code:0,stdout:"",stderr:""});assert.equal(calls.length,beforeDisabled);
  console.log("Hook fixtures passed: off, title cap, path opt-in, malformed input, invalid files, request failure, silence, and shutdown bounds.");
 }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));rmSync(dir,{recursive:true,force:true});}
}
if(process.argv[1]===fileURLToPath(import.meta.url))await hookFixtures();
