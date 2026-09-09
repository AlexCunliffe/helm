/** Admin-only setup reads and validation. No application-key bypass is public. */
import { internalQuery } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { settingsValidator, areaDoc } from "./validators";
import { readSettings, validateSettings } from "./lib/settings";
import { readAreas, validateArea } from "./areas";
const areasArg = v.array(v.object({key:v.string(),label:v.string(),color:v.string(),order:v.number(),vaultDomain:v.optional(v.string())}));
export const snapshot = internalQuery({
  args: {}, returns: v.object({settings:settingsValidator,areas:v.array(areaDoc),hasSettings:v.boolean(),hasApiKey:v.boolean(),hasSurfaceToken:v.boolean(),hasAnthropicKey:v.boolean()}),
  handler: async ctx => ({settings:await readSettings(ctx),areas:await readAreas(ctx),
    hasSettings:!!(await ctx.db.query("meta").withIndex("by_key",q=>q.eq("key","settings")).unique()),
    hasApiKey:!!process.env.HELM_API_KEY,hasSurfaceToken:!!process.env.HELM_SURFACE_TOKEN,hasAnthropicKey:!!process.env.ANTHROPIC_API_KEY}),
});
export const validate = internalQuery({
  args: {settings:settingsValidator,areas:areasArg}, returns:v.null(),
  handler:async(ctx,{settings,areas})=>{
    validateSettings(settings);
    if (!areas.length || areas.length>100 || new Set(areas.map(a=>a.key)).size!==areas.length) throw new ConvexError("Use 1 to 100 distinct areas.");
    for (const a of areas) validateArea(a);
    const existing=await readAreas(ctx);
    if(new Set([...existing.map(a=>a.key),...areas.map(a=>a.key)]).size>100) throw new ConvexError("Keep at most 100 total areas, including retired areas.");
    return null;
  },
});
