#!/usr/bin/env node
import { prompts } from "./lib/prompts.mjs";
import { locations, read, hash, loadManifest, saveManifest, backupName, writeGlobal, preview } from "./lib/claude-files.mjs";
async function main(){
  const args=process.argv.slice(2);
  if(args.includes("--help")){console.log("Usage: npm run uninstall:claude -- [--dry-run] [--yes]\nRestore recorded original files. Approve each change. Back up each installed file first.\nRefuse files edited after installation. Keep backups for manual recovery.");return;}
  if(args.some(a=>!["--dry-run","--yes"].includes(a)))throw new Error("Use --dry-run, --yes, or --help.");
  const dry=args.includes("--dry-run"),yes=args.includes("--yes"),loc=locations(),manifest=loadManifest(loc),p=prompts({defaultsOnly:dry||yes});
  let writes=0,conflicts=0;
  try{for(const entry of [...manifest.entries].reverse()){
    loc.safe(entry.path);loc.safe(entry.originalBackup,{backup:true});
    const before=read(entry.path);
    if(hash(before)===entry.originalHash){console.log("Already restored: "+entry.path);if(!dry){manifest.entries=manifest.entries.filter(e=>e!==entry);saveManifest(loc,manifest);}continue;}
    if(hash(before)!==entry.installedHash){console.log("Keep later edits: "+entry.path);conflicts++;continue;}
    const after=entry.originalHash===null?null:read(entry.originalBackup);
    if(hash(after)!==entry.originalHash){console.log("Keep file with missing or changed original backup: "+entry.path);conflicts++;continue;}
    const backup=backupName(entry.path);preview(entry.path,before,after,backup);
    console.log(after===null?"Remove the file created by Helm.":"Restore the original file from its backup.");
    if(dry){console.log("Dry run. No write.");continue;}
    if(!yes&&!await p.confirm("Restore this file and keep a backup? [y/N]")){console.log("Skip this file.");continue;}
    if(yes)console.log("Approved by --yes.");
    writeGlobal(loc,entry.path,before,after,backup,{mode:entry.originalMode});
    manifest.entries=manifest.entries.filter(e=>e!==entry);saveManifest(loc,manifest);writes++;
  }}finally{p.close();}
  console.log(dry?"Dry run complete. No files were written.":`Uninstall complete. Restored ${writes} file(s). Backups remain in their original directories.`);
  if(conflicts){console.log(`${conflicts} file(s) need manual reconciliation. Preserve later edits. Use the recorded backups as references.`);process.exitCode=1;}
}
main().catch(error=>{console.error("Uninstall failed. Check configuration paths, backups, and permissions. No unverified file will be overwritten.");process.exitCode=1;});
