/**
 * Areas — the brain's categories (docs/03). Data-driven and extensible:
 * adding/renaming a function is an `upsertArea` row, never a migration (docs/09).
 */
import { mutation, query } from "./_generated/server";
import { MutationCtx, QueryCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { v, ConvexError } from "convex/values";
import { areaDoc } from "./validators";
import { requireKey } from "./lib/auth";

const apiKeyArg = { apiKey: v.optional(v.string()) };

export async function readAreas(ctx: QueryCtx) {
  const rows = await ctx.db.query("areas").withIndex("by_key").take(101);
  if (rows.length > 100) throw new ConvexError("Helm supports at most 100 areas.");
  return rows;
}
export function validateArea(a: { key: string; label: string; color: string; order: number; vaultDomain?: string }) {
  if (!/^[a-z][a-z0-9_-]{0,63}$/.test(a.key) || !a.label.trim() || a.label.length > 120 ||
      !/^#[0-9a-f]{6}$/i.test(a.color) || !Number.isSafeInteger(a.order) || a.order < 0 || a.order > 10000 || (a.vaultDomain?.length ?? 0) > 200)
    throw new ConvexError("Use a lowercase area key, a label, a six-digit hex color, and an order from 0 to 10000.");
}

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
    throw new ConvexError(
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
    const configured = await ctx.db.query("areas").withIndex("by_key", q => q.eq("key", cfg.value as string)).unique();
    if (configured && !configured.archived) return configured._id;
  }
  const areas = await readAreas(ctx);
  const live = areas.filter((a) => !a.archived).sort((a, b) => a.order - b.order);
  if (live.length === 0) {
    throw new ConvexError("No areas seeded — run seedAreas first.");
  }
  return live[0]._id;
}

/** Idempotent bulk seed/refresh by key. Safe to re-run. */
export const seedAreas = mutation({
  args: {
    ...apiKeyArg,
    onlyIfEmpty: v.optional(v.boolean()),
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
  handler: async (ctx, { apiKey, areas, onlyIfEmpty }) => {
    requireKey(apiKey);
    return await seedAreaRows(ctx, areas, onlyIfEmpty ?? false);
  },
});

export async function seedAreaRows(ctx: MutationCtx, areas: Array<{ key: string; label: string; color: string; order: number; vaultDomain?: string }>, onlyIfEmpty: boolean) {
  if (!areas.length || areas.length > 100) throw new ConvexError("Use 1 to 100 areas.");
  const keys = new Set<string>();
  for (const a of areas) {
    if (!/^[a-z][a-z0-9_-]{0,63}$/.test(a.key) || keys.has(a.key)) throw new ConvexError("Use distinct lowercase area keys.");
    keys.add(a.key);
    if (!a.label.trim() || a.label.length > 120 || !/^#[0-9a-f]{6}$/i.test(a.color) ||
        !Number.isSafeInteger(a.order) || a.order < 0 || a.order > 10000 || (a.vaultDomain?.length ?? 0) > 200)
      throw new ConvexError("Invalid area label, color, order, or vaultDomain.");
  }
  if (onlyIfEmpty && await ctx.db.query("areas").withIndex("by_key").first()) return { inserted: 0, updated: 0 };
  const existingKeys = new Set((await readAreas(ctx)).map(a => a.key));
  if (new Set([...existingKeys, ...keys]).size > 100) throw new ConvexError("Helm supports at most 100 areas.");
  let inserted = 0, updated = 0;
  for (const a of areas) {
    const existing = await ctx.db.query("areas").withIndex("by_key", q => q.eq("key", a.key)).unique();
    if (existing) { await ctx.db.patch(existing._id, a); updated++; }
    else { await ctx.db.insert("areas", a); inserted++; }
  }
  return { inserted, updated };
}

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
    createOnly: v.optional(v.boolean()),
  },
  returns: v.id("areas"),
  handler: async (ctx, args) => {
    requireKey(args.apiKey);
    // apiKey is auth, not data — strip it before anything touches the row.
    const { apiKey: _apiKey, createOnly, ...area } = args;
    const existing = await ctx.db
      .query("areas")
      .withIndex("by_key", (q) => q.eq("key", area.key))
      .unique();
    if (createOnly && existing) throw new ConvexError("Choose an unused area key.");
    const all = await readAreas(ctx);
    const order = area.order ?? existing?.order ?? all.reduce((m, a) => Math.max(m, a.order), -1) + 1;
    validateArea({ ...area, order });
    if (!existing && all.length >= 100) throw new ConvexError("Helm supports at most 100 areas.");
    if (area.archived && !all.some(a => a.key !== area.key && !a.archived))
      throw new ConvexError("Keep at least one active area.");
    if (existing) {
      const { key: _key, ...patch } = area;
      await ctx.db.patch(existing._id, { ...patch, order });
      return existing._id;
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
    const areas = await readAreas(ctx);
    return areas
      .filter((a) => includeArchived || !a.archived)
      .sort((a, b) => a.order - b.order);
  },
});
