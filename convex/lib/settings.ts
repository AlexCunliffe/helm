import { ConvexError, type Infer } from "convex/values";
import type { QueryCtx } from "../_generated/server";
import { settingsValidator, settingsPatchValidator } from "../validators";

export type Settings = Infer<typeof settingsValidator>;
export type SettingsPatch = Infer<typeof settingsPatchValidator>;

export const DEFAULT_SETTINGS: Settings = {
  owner: { name: "", shortName: "", tone: "Plain, concise, and calm." },
  founderContext: "", timezone: "Europe/London",
  workday: { start: "08:00", end: "17:00", days: [1, 2, 3, 4, 5] },
  sources: [], hook: { logSessions: false, includeCwd: false, titleChars: 140 },
};

export async function readSettings(ctx: QueryCtx): Promise<Settings> {
  const row = await ctx.db.query("meta").withIndex("by_key", q => q.eq("key", "settings")).unique();
  return row ? row.value as Settings : JSON.parse(JSON.stringify(DEFAULT_SETTINGS)) as Settings;
}

function fail(field: string, reason: string): never {
  throw new ConvexError(`settings: ${field} ${reason}`);
}
function text(value: string | undefined, field: string, max: number) {
  if (value !== undefined && value.length > max) fail(field, `must have at most ${max} characters`);
}
function integer(value: number, field: string, min: number, max: number) {
  if (!Number.isInteger(value) || value < min || value > max) fail(field, `must be an integer from ${min} to ${max}`);
}
function minutes(value: string, field: string) {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) fail(field, "must use HH:MM");
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}
export function validateSettings(s: Settings): void {
  text(s.owner.name, "owner.name", 120); text(s.owner.shortName, "owner.shortName", 60);
  text(s.owner.role, "owner.role", 160); text(s.owner.business, "owner.business", 400);
  text(s.owner.tone, "owner.tone", 400); text(s.founderContext, "founderContext", 800);
  if (!s.timezone || s.timezone.length > 100) fail("timezone", "must be an IANA timezone");
  try { new Intl.DateTimeFormat("en", { timeZone: s.timezone }).format(0); }
  catch { fail("timezone", "must be an IANA timezone"); }
  const start = minutes(s.workday.start, "workday.start");
  const end = minutes(s.workday.end, "workday.end");
  if (end <= start) fail("workday.end", "must follow start on the same day");
  if (s.workday.eveningWatchFrom !== undefined && minutes(s.workday.eveningWatchFrom, "workday.eveningWatchFrom") < end)
    fail("workday.eveningWatchFrom", "must be at or after workday.end");
  if (!s.workday.days.length || s.workday.days.length > 7 || new Set(s.workday.days).size !== s.workday.days.length)
    fail("workday.days", "must contain one to seven distinct weekdays");
  for (const day of s.workday.days) integer(day, "workday.days", 1, 7);
  const limits: Record<string, [number, number]> = {
    today: [1, 20], wins: [0, 100], ageing: [0, 100], waiting: [0, 100],
    upcoming: [0, 100], newToday: [1, 200], waitingAgeingDays: [0, 3650],
    openAgeingDays: [0, 3650], meetingPrepLeadMin: [0, 1440], focusMinutes: [1, 240],
  };
  for (const [key, value] of Object.entries(s.caps ?? {})) if (value !== undefined)
    integer(value, `caps.${key}`, ...limits[key]);
  integer(s.hook.titleChars, "hook.titleChars", 1, 500);
  if (s.sources.length > 40) fail("sources", "must contain at most 40 sources");
  const seen = new Set<string>();
  for (const source of s.sources) {
    if (!/^[a-z][a-z0-9_-]{0,63}$/.test(source.key)) fail("sources.key", "must be a lowercase slug of at most 64 characters");
    if (seen.has(source.key)) fail("sources.key", "must be unique");
    seen.add(source.key);
    if (!source.label.trim()) fail("sources.label", "must not be empty");
    text(source.label, "sources.label", 120); text(source.mcpServer, "sources.mcpServer", 120);
    text(source.notes, "sources.notes", 2000);
    if (source.enabled && !source.mcpServer?.trim()) fail("sources.mcpServer", "must name a server for each enabled source");
  }
}

export function mergeSettings(current: Settings, patch: SettingsPatch): Settings {
  const caps = { ...current.caps };
  for (const [key, value] of Object.entries(patch.caps ?? {})) {
    if (value === null) delete caps[key as keyof typeof caps];
    else if (value !== undefined) caps[key as keyof typeof caps] = value;
  }
  const next: Settings = {
    ...current, ...patch,
    owner: { ...current.owner, ...patch.owner },
    workday: { ...current.workday, ...patch.workday,
      eveningWatchFrom: patch.workday?.eveningWatchFrom === null ? undefined
        : patch.workday?.eveningWatchFrom ?? current.workday.eveningWatchFrom },
    hook: { ...current.hook, ...patch.hook },
    caps: patch.caps === null || !Object.keys(caps).length ? undefined : caps,
  };
  // Omitted properties must not appear in the persisted JSON as undefined.
  const clean = JSON.parse(JSON.stringify(next)) as Settings;
  validateSettings(clean);
  return clean;
}
