/** Calendar arithmetic in a caller-supplied IANA timezone. */
import { ConvexError } from "convex/values";
export const DAY_MS = 86_400_000;
const formats = new Map<string, Intl.DateTimeFormat>();
function formatter(tz: string) {
  let format = formats.get(tz);
  if (!format) {
    format = new Intl.DateTimeFormat("en", { timeZone: tz, calendar: "gregory", numberingSystem: "latn",
      year: "numeric", month: "2-digit", day: "2-digit" });
    if (formats.size >= 32) formats.clear();
    formats.set(tz, format);
  }
  return format;
}
export function dateString(at: number, tz: string): string {
  const parts = formatter(tz).formatToParts(at);
  const part = (name: string) => parts.find(p => p.type === name)!.value;
  return `${part("year").padStart(4, "0")}-${part("month")}-${part("day")}`;
}
function utcDate(date: string): number {
  const at = Date.parse(date + "T00:00:00.000Z");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(at) || new Date(at).toISOString().slice(0, 10) !== date)
    throw new ConvexError("date: use a valid YYYY-MM-DD calendar date");
  return at;
}
export function shiftDate(date: string, days: number): string {
  return new Date(utcDate(date) + days * DAY_MS).toISOString().slice(0, 10);
}
export function nextDate(date: string): string { return shiftDate(date, 1); }

/** First instant of a calendar day. Handles offset changes at midnight and
 * skipped dates; a skipped date has an empty dayRange rather than a wrong day. */
export function midnight(date: string, tz: string): number {
  const guess = utcDate(date);
  let lo = guess - 2 * DAY_MS, hi = guess + 2 * DAY_MS;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (dateString(mid, tz) < date) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}
export function dayRange(date: string, tz: string): { start: number; end: number } {
  return { start: midnight(date, tz), end: midnight(nextDate(date), tz) };
}
