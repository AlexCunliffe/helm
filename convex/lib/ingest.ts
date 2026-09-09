import { v, ConvexError, Infer } from "convex/values";
import { sourceRefValidator } from "../validators";
export const ingestFields = {
  title:v.string(), note:v.optional(v.string()), areaKey:v.optional(v.string()),
  contextLine:v.optional(v.string()), sourceRef:v.optional(sourceRefValidator), dedupeKey:v.optional(v.string()),
};
const ingestValidator=v.object(ingestFields);
export type IngestInput=Infer<typeof ingestValidator>;
export function parseIngest(body:unknown):IngestInput {
  if(!body||typeof body!=="object"||Array.isArray(body))throw new ConvexError("Use a JSON object.");
  const input=body as Record<string,unknown>;
  const text=(key:string,max:number,required=false):string|undefined=>{
    const value=input[key];
    if(value===undefined&&!required)return undefined;
    if(typeof value!=="string"||value.length>max||(required&&!value.trim()))throw new ConvexError(`Use a valid ${key}.`);
    return value;
  };
  const title=text("title",500,true)!.trim(),note=text("note",10000),areaKey=text("areaKey",80),contextLine=text("contextLine",2000),dedupeKey=text("dedupeKey",200);
  if(dedupeKey!==undefined&&!dedupeKey.trim())throw new ConvexError("Use a non-empty dedupe key.");
  let sourceRef:IngestInput["sourceRef"];
  if(input.sourceRef!==undefined){
    if(!input.sourceRef||typeof input.sourceRef!=="object"||Array.isArray(input.sourceRef))throw new ConvexError("Use a sourceRef object.");
    const ref=input.sourceRef as Record<string,unknown>;
    if(Object.keys(ref).some(key=>!["url","threadId","label"].includes(key)))throw new ConvexError("Use supported sourceRef fields.");
    sourceRef={};
    for(const key of ["url","threadId","label"] as const){
      const value=ref[key];if(value===undefined)continue;
      if(typeof value!=="string"||value.length>(key==="url"?2048:500))throw new ConvexError("Use bounded sourceRef strings.");
      if(key==="url"){let url:URL;try{url=new URL(value);}catch{throw new ConvexError("Use an HTTP source URL.");}if(!["https:","http:"].includes(url.protocol)||url.username||url.password)throw new ConvexError("Use an HTTP source URL without credentials.");}
      sourceRef[key]=value;
    }
  }
  // Caller-supplied source, status, and review fields never cross this boundary.
  return {title,note,areaKey,contextLine,sourceRef,dedupeKey};
}
