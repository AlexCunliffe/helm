import { query, mutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { requireKey } from "./lib/auth";
import { readSettings, mergeSettings } from "./lib/settings";
import { settingsValidator, settingsPatchValidator } from "./validators";

export const get = query({
  args: { apiKey: v.optional(v.string()) }, returns: settingsValidator,
  handler: async (ctx, { apiKey }) => { requireKey(apiKey); return await readSettings(ctx); },
});

export const getInternal = internalQuery({
  args: {}, returns: settingsValidator,
  handler: async ctx => await readSettings(ctx),
});

export const update = mutation({
  args: { apiKey: v.optional(v.string()), patch: settingsPatchValidator },
  returns: settingsValidator,
  handler: async (ctx, { apiKey, patch }) => {
    requireKey(apiKey);
    const next = mergeSettings(await readSettings(ctx), patch);
    const row = await ctx.db.query("meta").withIndex("by_key", q => q.eq("key", "settings")).unique();
    if (row) await ctx.db.patch(row._id, { value: next });
    else await ctx.db.insert("meta", { key: "settings", value: next });
    return next;
  },
});
