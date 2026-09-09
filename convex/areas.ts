/**
 * Areas — the brain's categories (docs/03). Data-driven and extensible:
 * adding/renaming a function is an `upsertArea` row, never a migration (docs/09).
 */
import { mutation, query } from "./_generated/server";
import { QueryCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { areaDoc } from "./validators";
import { requireKey } from "./lib/auth";

const apiKeyArg = { apiKey: v.optional(v.string()) };

/**
 * Resolve an area key ("finance") → its id. Shared helper used by capture etc.
 * Throws on an unknown key so a typo can't silently mis-file a task.
 */
export async function resolveAreaId(ctx: QueryCtx, key: string): Promise<Id<"areas">> {
  const area = await ctx.db
    .query("areas")
    .withIndex("by_key", (q) => q.eq("key", key))
    .unique();
  if (!area) {
    throw new Error(
      `Unknown area key "${key}". Seed it first (seedAreas / upsertArea) — areas are data, not code.`,
    );
  }
  return area._id;
}

/**
 * The area a capture lands in when the client gives no key — capture must never
 * fail for lack of a category (zero-input, docs/01). Configurable via the meta
 * key `config:captureDefaultAreaKey`; otherwise the lowest-`order` live area.
 */
export async function defaultAreaId(ctx: QueryCtx): Promise<Id<"areas">> {
  const cfg = await ctx.db
    .query("meta")
    .withIndex("by_key", (q) => q.eq("key", "config:captureDefaultAreaKey"))
    .unique();
  if (cfg && typeof cfg.value === "string") {
    return await resolveAreaId(ctx, cfg.value);
  }
  const areas = await ctx.db.query("areas").collect();
  const live = areas.filter((a) => !a.archived).sort((a, b) => a.order - b.order);
  if (live.length === 0) {
    throw new Error("No areas seeded — run seedAreas first.");
  }
  return live[0]._id;
}

/** Idempotent bulk seed/refresh by key. Safe to re-run. */
export const seedAreas = mutation({
  args: {
    ...apiKeyArg,
    areas: v.array(
      v.object({
        key: v.string(),
        label: v.string(),
        color: v.string(),
        vaultDomain: v.optional(v.string()),
        order: v.number(),
      }),
    ),
  },
  returns: v.object({ inserted: v.number(), updated: v.number() }),
  handler: async (ctx, { apiKey, areas }) => {
    requireKey(apiKey);
    let inserted = 0;
    let updated = 0;
    for (const a of areas) {
      const existing = await ctx.db
        .query("areas")
        .withIndex("by_key", (q) => q.eq("key", a.key))
        .unique();
      if (existing) {
        await ctx.db.patch(existing._id, a);
        updated++;
      } else {
        await ctx.db.insert("areas", a);
        inserted++;
      }
    }
    return { inserted, updated };
  },
});

/** Upsert a single area by key (add/rename/recolour a function). */
export const upsertArea = mutation({
  args: {
    ...apiKeyArg, // NB: `key` below is the AREA key — auth is `apiKey`
    key: v.string(),
    label: v.string(),
    color: v.string(),
    vaultDomain: v.optional(v.string()),
    order: v.optional(v.number()),
    archived: v.optional(v.boolean()),
  },
  returns: v.id("areas"),
  handler: async (ctx, args) => {
    requireKey(args.apiKey);
    // apiKey is auth, not data — strip it before anything touches the row.
    const { apiKey: _apiKey, ...area } = args;
    const existing = await ctx.db
      .query("areas")
      .withIndex("by_key", (q) => q.eq("key", area.key))
      .unique();
    // Default order: append after the current max (so new areas land last).
    if (existing) {
      const { key: _key, ...patch } = area;
      await ctx.db.patch(existing._id, patch);
      return existing._id;
    }
    let order = area.order;
    if (order === undefined) {
      const all = await ctx.db.query("areas").collect();
      order = all.reduce((m, a) => Math.max(m, a.order), 0) + 1;
    }
    return await ctx.db.insert("areas", { ...area, order });
  },
});

/** List areas in display order. `archived` hidden unless asked. */
export const listAreas = query({
  args: { ...apiKeyArg, includeArchived: v.optional(v.boolean()) },
  returns: v.array(areaDoc),
  handler: async (ctx, { apiKey, includeArchived }) => {
    requireKey(apiKey);
    const areas = await ctx.db.query("areas").collect();
    return areas
      .filter((a) => includeArchived || !a.archived)
      .sort((a, b) => a.order - b.order);
  },
});
