/**
 * Meta — singletons: watermarks & config (docs/03). The intraday sweep keeps a
 * per-source watermark here (`sweep:<source>:lastAt`) so each run only processes
 * items newer than last time and then advances it — bounded work, low cost
 * (docs/05). `value` is `v.any()`; callers own the shape per key.
 */
import { mutation, query } from "./_generated/server";
import { MutationCtx, QueryCtx } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { requireKey } from "./lib/auth";

// NB: `key` args below are META keys — auth is `apiKey` (4.1, D15).
const apiKeyArg = { apiKey: v.optional(v.string()) };

function watermarkKey(source: string): string {
  return `sweep:${source}:lastAt`;
}

async function readMeta(ctx: QueryCtx | MutationCtx, key: string) {
  return await ctx.db
    .query("meta")
    .withIndex("by_key", (q) => q.eq("key", key))
    .unique();
}

export const getMeta = query({
  args: { ...apiKeyArg, key: v.string() },
  returns: v.union(v.any(), v.null()),
  handler: async (ctx, { apiKey, key }) => {
    requireKey(apiKey);
    const row = await readMeta(ctx, key);
    return row ? row.value : null;
  },
});

export const setMeta = mutation({
  args: { ...apiKeyArg, key: v.string(), value: v.any() },
  returns: v.null(),
  handler: async (ctx, { apiKey, key, value }) => {
    requireKey(apiKey);
    if (key === "settings") throw new ConvexError("Use settings:update for validated settings.");
    const row = await readMeta(ctx, key);
    if (row) await ctx.db.patch(row._id, { value });
    else await ctx.db.insert("meta", { key, value });
    return null;
  },
});

/** Watermark for a sweep source (epoch ms). 0 when never swept. */
export const getWatermark = query({
  args: { ...apiKeyArg, source: v.string() },
  returns: v.number(),
  handler: async (ctx, { apiKey, source }) => {
    requireKey(apiKey);
    const row = await readMeta(ctx, watermarkKey(source));
    return typeof row?.value === "number" ? row.value : 0;
  },
});

/**
 * Advance a source's watermark. Monotonic — only ever moves forward, so an
 * out-of-order or retried sweep can't rewind it and re-pull old items.
 */
export const advanceWatermark = mutation({
  args: { ...apiKeyArg, source: v.string(), at: v.number() },
  returns: v.number(),
  handler: async (ctx, { apiKey, source, at }) => {
    requireKey(apiKey);
    const key = watermarkKey(source);
    const row = await readMeta(ctx, key);
    const current = typeof row?.value === "number" ? row.value : 0;
    const next = Math.max(current, at);
    if (row) await ctx.db.patch(row._id, { value: next });
    else await ctx.db.insert("meta", { key, value: next });
    return next;
  },
});
