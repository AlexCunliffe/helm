import { readFileSync, writeFileSync, existsSync, lstatSync, mkdirSync, renameSync, unlinkSync, realpathSync, chmodSync } from "node:fs";
import { resolve, join, dirname, relative, sep } from "node:path";
import { homedir } from "node:os";
import { createHash, randomUUID } from "node:crypto";
import { ROOT } from "./dev.mjs";

export const hash = text => text === null ? null : createHash("sha256").update(text).digest("hex");
export const json = value => JSON.stringify(value, null, 2) + "\n";
export const quote = value => "'" + value.replaceAll("'", "'\\''") + "'";
export function locations() {
  const home = realpathSync(process.env.HOME || homedir());
  const config = resolve(process.env.CLAUDE_CONFIG_DIR || join(home, ".claude"));
  const mcp = process.env.CLAUDE_CONFIG_DIR ? join(config, ".claude.json") : join(home, ".claude.json");
  const manifest = join(ROOT, ".helm-local", "installs", hash(home + "\n" + config) + ".json");
  const files = [mcp, join(config, "settings.json"), join(config, "CLAUDE.md"),
    ...["brief", "capture", "sweep", "reconcile"].map(n => join(config, "skills", "helm-" + n, "SKILL.md")),
    ...["sweep", "reconcile"].map(n => join(config, "scheduled-tasks", "helm-" + n, "SKILL.md"))];
  const within = path => { const rel = relative(home, resolve(path)); return rel && rel !== ".." && !rel.startsWith(".." + sep) && !rel.startsWith(sep); };
  if (!within(config)) throw new Error("Keep CLAUDE_CONFIG_DIR inside the selected home directory.");
  function safe(path, { backup = false } = {}) {
    const target = resolve(path);
    if (!within(target) || !(files.includes(target) || (backup && files.some(f => target.startsWith(f + ".bak-helm-"))))) throw new Error("Refuse an unexpected global path.");
    let cursor = home;
    for (const part of relative(home, target).split(sep)) {
      cursor = join(cursor, part);
      if (existsSync(cursor) || (() => {try {lstatSync(cursor); return true;} catch {return false;}})()) {
        const stat = lstatSync(cursor);
        if (stat.isSymbolicLink()) throw new Error("Refuse a symbolic link in a global path.");
        if (cursor !== target && !stat.isDirectory()) throw new Error("A global parent path is not a directory.");
        if (cursor === target && !stat.isFile()) throw new Error("A global file path is not a regular file.");
      }
    }
    return target;
  }
  return { home, config, mcp, manifest, files, safe };
}
export function read(path) {try { const stat=lstatSync(path); if(!stat.isFile()||stat.isSymbolicLink()||stat.size>2*1024*1024)throw new Error("Use a regular configuration file smaller than 2 MiB."); return readFileSync(path,"utf8"); } catch(error) {if(error.code==="ENOENT") return null; throw error;} }
export function object(text) {const value=text===null?{}:JSON.parse(text);if(!value||typeof value!=="object"||Array.isArray(value))throw new Error("Use a JSON object for Claude configuration.");return value;}
export function loadManifest(loc) {
  localSafe(loc.manifest);
  const text=read(loc.manifest);if(text===null)return {version:1,entries:[]};
  const value=JSON.parse(text);
  if(value.version!==1||!Array.isArray(value.entries))throw new Error("The installation record is invalid.");
  for(const entry of value.entries){loc.safe(entry.path);loc.safe(entry.originalBackup,{backup:true});if(typeof entry.installedHash!=="string"||!(entry.originalHash===null||typeof entry.originalHash==="string"))throw new Error("The installation record is invalid.");}
  return value;
}
function localSafe(path) {
  let cursor=ROOT;
  for(const part of relative(ROOT,path).split(sep)) {cursor=join(cursor,part);try {if(lstatSync(cursor).isSymbolicLink())throw new Error("Refuse a symbolic link in the installation record path.");}catch(error){if(error.code!=="ENOENT")throw error;}}
}
export function saveManifest(loc,manifest) {localSafe(loc.manifest);mkdirSync(dirname(loc.manifest),{recursive:true,mode:0o700});atomic(loc.manifest,json(manifest),0o600);}
function atomic(path,text,mode=0o600) {
  const temp=path+".helm-tmp-"+randomUUID();
  try{writeFileSync(temp,text,{flag:"wx",mode});renameSync(temp,path);chmodSync(path,mode);}finally{try{unlinkSync(temp);}catch(error){if(error.code!=="ENOENT")throw error;}}
}
export function backupName(path) {return path+".bak-helm-"+new Date().toISOString().replaceAll(":","-")+"-"+randomUUID().slice(0,8);}
export function writeGlobal(loc,path,before,after,backup,{mode=0o600,beforeReplace=()=>{}}={}) {
  loc.safe(path);loc.safe(backup,{backup:true});
  if(read(path)!==before)throw new Error("Configuration changed after the preview. Run the command again.");
  mkdirSync(dirname(path),{recursive:true,mode:0o700});
  writeFileSync(backup,before??"Helm backup: this file did not exist.\n",{flag:"wx",mode:0o600});
  beforeReplace();
  if(after===null)unlinkSync(path);else atomic(path,after,mode);
}
export function secretText(text,secrets=[]) {
  let out=text;
  for(const secret of secrets)if(secret)out=out.replaceAll(secret,"[redacted]");
  return out.replace(/\b[0-9a-f]{48}\b/gi,"[redacted]").replace(/sk-ant-[\w-]+/g,"[redacted]");
}
function privateJSON(text) {
  if(text===null)return "";
  function mask(value){if(Array.isArray(value))return value.map(mask);if(value&&typeof value==="object")return Object.fromEntries(Object.entries(value).map(([key,child])=>[key,mask(child)]));return typeof value==="string"?"[private value]":value;}
  return json(mask(object(text)));
}
export function preview(path,before,after,backup,secrets=[]) {
  console.log(`\nFile: ${path}\nBackup before write: ${backup}`);
  console.log("Use a temporary sibling file for the atomic replacement. Create missing parent directories.");
  const clean=text=>path.endsWith(".json")?privateJSON(text):secretText(text??"",secrets);
  const old=clean(before).split("\n"),next=clean(after).split("\n");
  let start=0;while(start<old.length&&start<next.length&&old[start]===next[start])start++;
  let endOld=old.length,endNext=next.length;while(endOld>start&&endNext>start&&old[endOld-1]===next[endNext-1]){endOld--;endNext--;}
  console.log(`--- current\n+++ proposed\n${[...old.slice(start,endOld).map(l=>"-"+l),...next.slice(start,endNext).map(l=>"+"+l)].join("\n")||"Private values changed. Values are hidden."}`);
  if(path.endsWith(".json"))console.log("JSON string values are hidden. The structure and changed fields are shown.");
}
