/**
 * Shared validators & field shapes for Helm.
 *
 * Single source of truth: `defineTable` (schema.ts) and the `args`/`returns`
 * validators on every function both import from here, so the wire shape and the
 * stored shape can never drift. See docs/03 (data model) and docs/09
 * (scalability — developer enums are additive unions, categories are data).
 */
import { v } from "convex/values";

// ── Developer enums (rarely-changing → unions; extend with a one-line edit) ──

/** Task lifecycle. `done`/`dropped` are terminal. docs/03. */
export const statusValidator = v.union(
  v.literal("inbox"), // captured, not yet triaged
  v.literal("today"), // chosen for today
  v.literal("next"), // queued, actionable soon
  v.literal("waiting"), // blocked on someone else
  v.literal("someday"), // deferred, no-guilt
  v.literal("done"),
  v.literal("dropped"),
);

/**
 * The statuses `capture` (a forward task) may set. Excludes the terminal
 * `done`/`dropped` — completions go through `logCompletion`/`markDone`, which
 * stamp `doneAt`; letting `capture` mint a `done` row with no `doneAt` would
 * make it invisible to dayLog/streak (which read the `by_done` index).
 */
export const captureStatusValidator = v.union(
  v.literal("inbox"),
  v.literal("today"),
  v.literal("next"),
  v.literal("waiting"),
  v.literal("someday"),
);

/** Forward intention vs after-the-fact completion. The load-bearing field. docs/03. */
export const originValidator = v.union(v.literal("planned"), v.literal("adhoc"));

/** 2-min / focus / deep. */
export const sizeValidator = v.union(v.literal("xs"), v.literal("m"), v.literal("l"));

/** Where a task came from + how to re-enter it. */
export const sourceRefValidator = v.object({
  url: v.optional(v.string()),
  threadId: v.optional(v.string()),
  label: v.optional(v.string()),
});

export const projectStatusValidator = v.union(
  v.literal("active"),
  v.literal("paused"),
  v.literal("done"),
);

export const checkinKindValidator = v.union(v.literal("morning"), v.literal("evening"));

// ── Table field shapes (consumed by defineTable AND by `returns` validators) ──

export const areaFields = {
  key: v.string(), // stable slug used by clients, e.g. "finance"
  label: v.string(),
  color: v.string(), // hex for surfaces
  vaultDomain: v.optional(v.string()), // bridge to a second-brain domain (docs/08)
  order: v.number(),
  archived: v.optional(v.boolean()),
};

export const taskFields = {
  title: v.string(),
  note: v.optional(v.string()),
  areaId: v.id("areas"),
  projectId: v.optional(v.id("projects")),

  status: statusValidator,
  origin: originValidator,
  size: v.optional(sizeValidator),
  urgent: v.optional(v.boolean()),

  source: v.string(), // free string, registry-documented (docs/03, docs/09)
  sourceRef: v.optional(sourceRefValidator),
  contextLine: v.optional(v.string()), // "where this is at" — kills re-entry cost
  kickoffPrompt: v.optional(v.string()), // ready-to-run instruction (docs/07)
  vaultRef: v.optional(v.string()), // relative path/slug to a second-brain note (docs/08)

  waitingOn: v.optional(v.string()),
  waitingSince: v.optional(v.number()),
  snoozeUntil: v.optional(v.number()),
  wokeAt: v.optional(v.number()), // when the waker returned it ("Back as promised", docs/06-surfaces.md) — glass shows the tag while fresh
  dueAt: v.optional(v.number()),
  startedAt: v.optional(v.number()), // when work first began (Focus/Now engagement) — true active-time = startedAt→doneAt (docs/06-surfaces.md); feeds the energy-learning loop
  doneAt: v.optional(v.number()),
  completionNote: v.optional(v.string()), // note captured at completion for future reference (Shift+D "Done + Notes")

  needsReview: v.optional(v.boolean()), // proposed by a sweep, awaiting one-tap confirm
  provisional: v.optional(v.boolean()), // auto-logged completion (hook); evening reconcile refines/merges (docs/08, Phase 1)
  dedupeKey: v.optional(v.string()), // idempotent capture
  updatedAt: v.number(),

  // ── merge + connect (Phase 5, docs/03-data-model.md) — all additive ──
  links: v.optional(v.array(v.id("tasks"))), // connect: symmetric adjacency — clusters emerge as connected components
  mergedInto: v.optional(v.id("tasks")), // set on a merged-away (dropped) source — traceable, not lost
  mergedFrom: v.optional(
    v.array(
      v.object({
        title: v.string(),
        sourceRef: v.optional(sourceRefValidator),
        dedupeKey: v.optional(v.string()),
      }),
    ),
  ), // provenance of everything folded into this task
  dedupeAliases: v.optional(v.array(v.string())), // re-sweep-safe merge: the source's dedupeKey lives on here
};

/**
 * Meetings (4.2, D12) — a rolling server-side mirror of today+tomorrow's
 * Google Calendar events, so the day thread can show markers/countdowns and
 * the waker can promote linked prep tasks at T-30 (docs/06-surfaces.md). Replaced
 * wholesale per sync window; never a historical archive.
 */
export const meetingFields = {
  eventId: v.string(), // Google Calendar event id — stable across syncs
  title: v.string(),
  startAt: v.number(),
  endAt: v.number(),
  url: v.optional(v.string()), // htmlLink / meet link for the hover card
  prepTaskId: v.optional(v.id("tasks")), // linked prep task (auto-promoted at T-30)
  prepPromotedAt: v.optional(v.number()), // stamp so a demoted prep isn't re-promoted
  updatedAt: v.number(),
};

export const projectFields = {
  name: v.string(),
  areaId: v.id("areas"),
  status: projectStatusValidator,
  note: v.optional(v.string()),
  vaultRef: v.optional(v.string()),
};

export const checkinFields = {
  fixtureRunId: v.optional(v.string()), // regression ownership; normal writes clear it
  date: v.string(), // "2026-06-24" (Europe/London)
  kind: checkinKindValidator,
  chosen: v.array(v.id("tasks")),
  completedPlanned: v.array(v.id("tasks")),
  completedAdhoc: v.array(v.id("tasks")),
  carried: v.array(v.id("tasks")),
  summary: v.optional(v.string()),
};

// ── Full document validators (system fields + table fields) for `returns` ──

const systemFields = <T extends string>(table: T) => ({
  _id: v.id(table),
  _creationTime: v.number(),
});

export const areaDoc = v.object({ ...systemFields("areas"), ...areaFields });
export const meetingDoc = v.object({ ...systemFields("meetings"), ...meetingFields });
export const taskDoc = v.object({ ...systemFields("tasks"), ...taskFields });
export const projectDoc = v.object({ ...systemFields("projects"), ...projectFields });
export const checkinDoc = v.object({ ...systemFields("checkins"), ...checkinFields });

/** A task's area folded in, so surfaces render without a second lookup. */
export const areaSummary = v.object({
  key: v.string(),
  label: v.string(),
  color: v.string(),
});

/** A task hydrated with its area — the shape every surface-facing read returns. */
export const taskView = v.object({
  ...systemFields("tasks"),
  ...taskFields,
  area: areaSummary,
  // When the task was initially added. Mirrors `_creationTime`, but named so
  // surfaces can render "added on / age" without depending on a raw system
  // field. Survives re-capture (upsert patches, so `_creationTime` is kept).
  addedAt: v.number(),
});

// Settings live in one indexed meta row. The wire schema is shared by readers
// and writers; section patches preserve fields omitted by a client.
export const ownerFields = {
  name: v.string(), shortName: v.string(), role: v.optional(v.string()),
  business: v.optional(v.string()), tone: v.string(),
};
export const workdayFields = {
  start: v.string(), end: v.string(), days: v.array(v.number()),
  eveningWatchFrom: v.optional(v.string()),
};
export const capsFields = {
  today: v.optional(v.number()), wins: v.optional(v.number()),
  ageing: v.optional(v.number()), waiting: v.optional(v.number()),
  upcoming: v.optional(v.number()), newToday: v.optional(v.number()),
  waitingAgeingDays: v.optional(v.number()), openAgeingDays: v.optional(v.number()),
  meetingPrepLeadMin: v.optional(v.number()), focusMinutes: v.optional(v.number()),
};
export const sourceValidator = v.object({
  key: v.string(), label: v.string(),
  kind: v.union(v.literal("email"), v.literal("chat"), v.literal("calendar"),
    v.literal("meetings"), v.literal("tracker"), v.literal("custom")),
  mcpServer: v.optional(v.string()), enabled: v.boolean(), notes: v.optional(v.string()),
});
export const hookFields = {
  logSessions: v.boolean(), includeCwd: v.boolean(), titleChars: v.number(),
};
export const settingsFields = {
  owner: v.object(ownerFields), founderContext: v.string(), timezone: v.string(),
  workday: v.object(workdayFields), caps: v.optional(v.object(capsFields)),
  sources: v.array(sourceValidator), hook: v.object(hookFields),
};
export const settingsValidator = v.object(settingsFields);
export const settingsPatchValidator = v.object({
  owner: v.optional(v.object({
    name: v.optional(v.string()), shortName: v.optional(v.string()),
    role: v.optional(v.string()), business: v.optional(v.string()), tone: v.optional(v.string()),
  })),
  founderContext: v.optional(v.string()), timezone: v.optional(v.string()),
  workday: v.optional(v.object({
    start: v.optional(v.string()), end: v.optional(v.string()),
    days: v.optional(v.array(v.number())),
    eveningWatchFrom: v.optional(v.union(v.string(), v.null())),
  })),
  caps: v.optional(v.union(v.object({
    today: v.optional(v.union(v.number(), v.null())), wins: v.optional(v.union(v.number(), v.null())),
    ageing: v.optional(v.union(v.number(), v.null())), waiting: v.optional(v.union(v.number(), v.null())),
    upcoming: v.optional(v.union(v.number(), v.null())), newToday: v.optional(v.union(v.number(), v.null())),
    waitingAgeingDays: v.optional(v.union(v.number(), v.null())), openAgeingDays: v.optional(v.union(v.number(), v.null())),
    meetingPrepLeadMin: v.optional(v.union(v.number(), v.null())), focusMinutes: v.optional(v.union(v.number(), v.null())),
  }), v.null())),
  sources: v.optional(v.array(sourceValidator)),
  hook: v.optional(v.object({
    logSessions: v.optional(v.boolean()), includeCwd: v.optional(v.boolean()),
    titleChars: v.optional(v.number()),
  })),
});
