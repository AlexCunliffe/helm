/** Explicit operation capacities; complete reads never silently truncate. */
import { ConvexError } from "convex/values";
import type { QueryCtx, MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
export const PARTITION_LIMIT = 1000;
export const READ_ROW_LIMIT = 4000;
export const READ_BYTE_LIMIT = 4 * 1024 * 1024;
const budgets = new WeakMap<object, { rows: number; bytes: number }>();
const encoder = new TextEncoder();
export function accountRead<T>(ctx: object, row: T): T {
  if (row === null || row === undefined) return row;
  const budget = budgets.get(ctx) ?? { rows: 0, bytes: 0 };
  budget.rows++; budget.bytes += encoder.encode(JSON.stringify(row)).byteLength;
  budgets.set(ctx, budget);
  if (budget.rows > READ_ROW_LIMIT || budget.bytes > READ_BYTE_LIMIT)
    throw new ConvexError("Read capacity exceeded (4000 rows or 4 MiB). Narrow the request or use listPage for history.");
  return row;
}
export async function boundedRows<T>(ctx: object, query: AsyncIterable<T>, label: string, limit = PARTITION_LIMIT, complete = true): Promise<T[]> {
  const rows: T[] = [];
  for await (const row of query) {
    accountRead(ctx, row);
    if (rows.length === limit) throw new ConvexError(`${label} exceeds ${limit} rows. Narrow the request or use listPage for history.`);
    rows.push(row);
    if (!complete && rows.length === limit) break;
  }
  return rows;
}
export async function readTask(ctx: QueryCtx | MutationCtx, id: Id<"tasks">) {
  return accountRead(ctx, await ctx.db.get(id));
}
export function positiveLimit(value: number | undefined, fallback = 50, maximum = 200) {
  const limit = value ?? fallback;
  if (!Number.isInteger(limit) || limit < 1 || limit > maximum)
    throw new ConvexError(`Use an integer limit from 1 to ${maximum}.`);
  return limit;
}
