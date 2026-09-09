/** The surface token grants proposal submission, not the public task write API. */
import { internalMutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { ingestFields, parseIngest } from "./lib/ingest";
import { defaultAreaId, resolveAreaId } from "./areas";
export const propose = internalMutation({
  args:ingestFields,
  returns:v.object({taskId:v.id("tasks"),created:v.boolean()}),
  handler:async(ctx,input)=>{
    const args=parseIngest(input),dedupeKey=args.dedupeKey===undefined?undefined:`ingest:${args.dedupeKey}`;
    if(dedupeKey!==undefined){
      const matches=await ctx.db.query("tasks").withIndex("by_dedupe",q=>q.eq("dedupeKey",dedupeKey)).take(2);
      if(matches.length>1)throw new ConvexError("The ingest dedupe key is ambiguous.");
      const existing=matches[0];
      if(existing){
        // Do not follow merge pointers or refresh anything the owner accepted or triaged.
        if(existing.source==="ingest"&&existing.needsReview===true&&existing.status==="inbox"&&!existing.mergedInto){
          await ctx.db.patch(existing._id,{title:args.title,
            ...(args.note!==undefined?{note:args.note}:{}),
            ...(args.contextLine!==undefined?{contextLine:args.contextLine}:{}),
            ...(args.sourceRef!==undefined?{sourceRef:args.sourceRef}:{}),updatedAt:Date.now()});
        }
        return{taskId:existing._id,created:false};
      }
    }
    const areaId=args.areaKey?await resolveAreaId(ctx,args.areaKey):await defaultAreaId(ctx);
    const taskId=await ctx.db.insert("tasks",{title:args.title,note:args.note,contextLine:args.contextLine,sourceRef:args.sourceRef,
      dedupeKey,areaId,status:"inbox",origin:"planned",source:"ingest",needsReview:true,updatedAt:Date.now()});
    return{taskId,created:true};
  },
});
