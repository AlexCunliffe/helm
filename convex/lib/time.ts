/**
 * Europe/London day math. All Helm times are epoch ms; we format to London at
 * the edges (docs/04). DST-correct via Intl offsets — Helm lives in one
 * timezone, so this is bounded and exact (no date library needed).
 */
const TZ = "Europe/London";

/** Milliseconds the London wall clock is ahead of UTC at instant `at`. */
function offsetMs(at: number): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const m: Record<string, string> = {};
  for (const p of dtf.formatToParts(new Date(at))) {
    if (p.type !== "literal") m[p.type] = p.value;
  }
  const asUTC = Date.UTC(+m.year, +m.month - 1, +m.day, +m.hour, +m.minute, +m.second);
  return asUTC - at;
}

/** "YYYY-MM-DD" for the London calendar date containing `at`. */
export function londonDateString(at: number): string {
  const d = new Date(at + offsetMs(at));
  const y = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
  const da = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${mo}-${da}`;
}

/** Epoch ms of London-local midnight that opens the given "YYYY-MM-DD". */
export function londonMidnight(date: string): number {
  const [y, mo, da] = date.split("-").map(Number);
  const guessUTC = Date.UTC(y, mo - 1, da, 0, 0, 0);
  return guessUTC - offsetMs(guessUTC);
}

/** The "YYYY-MM-DD" after the given one (DST-safe via a +26h hop). */
export function nextDate(date: string): string {
  return londonDateString(londonMidnight(date) + 26 * 3600 * 1000);
}

/** Half-open epoch-ms range [start, end) covering one London calendar day. */
export function londonDayRange(date: string): { start: number; end: number } {
  return { start: londonMidnight(date), end: londonMidnight(nextDate(date)) };
}

export const DAY_MS = 86_400_000;
