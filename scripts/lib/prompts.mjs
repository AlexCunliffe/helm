import { createInterface } from "node:readline";
import { Writable } from "node:stream";
export function prompts({ defaultsOnly = false } = {}) {
  let muted=false;
  const output=new Writable({write(chunk,encoding,callback){if(!muted)process.stdout.write(chunk,encoding);callback();}});
  const rl=defaultsOnly?null:createInterface({input:process.stdin,output,terminal:!!process.stdin.isTTY});
  const lines=rl?.[Symbol.asyncIterator]();
  async function ask(label,value="",{secret=false}={}) {
    if(defaultsOnly)return value;
    process.stdout.write(`${label}${!secret&&value!==""?` [${value}]`:""}: `);
    muted=secret;
    let next;
    try{next=await lines.next();}finally{muted=false;if(secret)process.stdout.write("\n");}
    if(next.done)throw new Error("Input ended before the answer was complete.");
    const answer=next.value.trim();
    return answer==="-"?"":answer||value;
  }
  return {ask,confirm:async label=>/^y(es)?$/i.test(await ask(label,"")),close:()=>rl?.close()};
}
