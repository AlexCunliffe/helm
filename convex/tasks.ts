/**
 * Task write API (docs/04). Mutations are thin and total; composition lives in
 * the client (Claude). The brain stays "dumb data + good queries" (docs/07).
 *
 * Two doors in:
 *  - `capture`        — a forward task (origin:planned). Upsert by dedupeKey.
 *  - `logCompletion`  — work that already happened (origin:adhoc, status:done).
 * Plus the no-guilt status verbs: markDone, snooze, defer, setStatus, update,
 * confirmProposed.
 */
import { mutation, internalMutation, query } from "./_generated/server";
import { MutationCtx } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { v, ConvexError } from "convex/values";
import {
  statusValidator,
  captureStatusValidator,
  sizeValidator,
  sourceRefValidator,
  taskDoc,
} from "./validators";
import { resolveAreaId, defaultAreaId } from "./areas";
import { isClosed } from "./lib/views";
import { requireKey } from "./lib/auth";
import { dateString } from "./lib/time";
import { readSettings } from "./lib/settings";
import { removeFromNow } from "./lib/nowOrder";

// Every public function takes this and calls requireKey first (4.1, D15).
const apiKeyArg = { apiKey: v.optional(v.string()) };

/** Fetch a single task by id (client re-entry; null if gone). */
export const get = query({
  args: { ...apiKeyArg, id: v.id("tasks") },
  returns: v.union(taskDoc, v.null()),
  handler: async (ctx, { apiKey, id }) => {
    requireKey(apiKey);
    return await ctx.db.get(id);
  },
});

/**
 * Apply a status transition, keeping the timestamp side-effects honest:
 * entering `done` stamps `doneAt`; entering `waiting` stamps `waitingSince`.
 * Re-marking an already-done task doesn't move its clock, but ENTERING done
 * from any other status restamps — a reopened task's re-completion belongs to
 * the day it actually happened, not the day it was first done (dayLog/streak
 * read `doneAt`). Leaving `done` clears the stamp: un-completing removes the
 * task from dayLog/streak — this is what the glass Z-undo rides on.
 */
async function applyStatus(
  ctx: MutationCtx,
  id: Id<"tasks">,
  status: Doc<"tasks">["status"], // derived from the schema — one source of truth
  now: number,
): Promise<void> {
  const task = await ctx.db.get(id);
  if (!task) throw new ConvexError(`Task ${id} not found.`);
  const patch: Record<string, unknown> = { status, updatedAt: now };
  if (status === "done") {
    if (task.status !== "done" || task.doneAt === undefined) patch.doneAt = now;
  } else if (task.doneAt !== undefined) {
    // Leaving `done` un-completes the task — drop the stamp so it exits the
    // dayLog/streak (by_done) index. This is what an undo of a completion rides on.
    patch.doneAt = undefined;
  }
  // Stamp the block clock on entering waiting; clear it on leaving so a later
  // re-block restamps "now" rather than carrying a stale (and mis-ageing) time.
  if (status === "waiting") {
    if (task.waitingSince === undefined) patch.waitingSince = now;
  } else if (task.waitingSince !== undefined) {
    patch.waitingSince = undefined;
  }
  // A completed/dropped task is no longer "awaiting confirm" — drop the flag so
  // the review count and list can't diverge from each other.
  if ((status === "done" || status === "dropped") && task.needsReview) {
    patch.needsReview = false;
  }
  await ctx.db.patch(id, patch);
  if (status !== "today") {
    const settings = await readSettings(ctx);
    await removeFromNow(ctx, dateString(now, settings.timezone), id);
  }
}

/**
 * All rows for a dedupe key (oldest → newest) plus the open one, if any. A key
 * accumulates rows across done→resurrect cycles, so callers must never assume
 * a single match (a lone `.first()` would keep finding the oldest done row and
 * mint duplicates).
 *
 * Merge-aware (docs/03-data-model.md): a merged-away source keeps its dedupeKey but is
 * `dropped` with a `mergedInto` pointer — treating it as a plain dropped row
 * would suppress its thread forever while the merged task lives on. So each
 * match follows its `mergedInto` chain to the surviving task and THAT is what
 * the caller sees: a re-swept source thread refreshes (or completes) the merge
 * target, and the done/dropped semantics apply to the target's state, not the
 * husk's. Rides the existing `by_dedupe` index — `dedupeAliases[]` on the
 * target is provenance, not a lookup path (arrays aren't indexable).
 */
async function dedupeMatches(ctx: MutationCtx, dedupeKey: string) {
  const rows = await ctx.db
    .query("tasks")
    .withIndex("by_dedupe", (q) => q.eq("dedupeKey", dedupeKey))
    .collect();
  const matches: Doc<"tasks">[] = [];
  const seen = new Set<Id<"tasks">>();
  for (const row of rows) {
    let cur = row;
    const visited = new Set<Id<"tasks">>([cur._id]);
    while (cur.mergedInto) {
      const next = await ctx.db.get(cur.mergedInto);
      if (!next || visited.has(next._id)) break; // dangling pointer / cycle guard
      visited.add(next._id);
      cur = next;
    }
    if (!seen.has(cur._id)) {
      seen.add(cur._id);
      matches.push(cur);
    }
  }
  matches.sort((a, b) => a._creationTime - b._creationTime);
  return { matches, open: matches.find((t) => !isClosed(t)) };
}

// ── capture: a forward task ──────────────────────────────────────────────────

export const capture = mutation({
  args: {
    ...apiKeyArg,
    title: v.string(),
    note: v.optional(v.string()),
    areaKey: v.optional(v.string()), // resolved key→id; defaults if omitted
    projectId: v.optional(v.id("projects")),
    status: v.optional(captureStatusValidator), // default "inbox"; forward statuses only (no done/dropped)
    size: v.optional(sizeValidator),
    urgent: v.optional(v.boolean()),
    source: v.optional(v.string()), // default "manual"
    sourceRef: v.optional(sourceRefValidator),
    contextLine: v.optional(v.string()),
    kickoffPrompt: v.optional(v.string()),
    vaultRef: v.optional(v.string()),
    waitingOn: v.optional(v.string()),
    dueAt: v.optional(v.number()),
    needsReview: v.optional(v.boolean()), // true when proposed by a sweep
    dedupeKey: v.optional(v.string()),
    reopenCompleted: v.optional(v.boolean()), // false for repeated rolling-window reads
  },
  returns: v.object({ taskId: v.id("tasks"), created: v.boolean() }),
  handler: async (ctx, args) => {
    requireKey(args.apiKey);
    const now = Date.now();
    if (args.reopenCompleted === false && !args.dedupeKey)
      throw new ConvexError("Supply a dedupe key when reopenCompleted is false.");

    // Idempotent capture: a thread already captured won't double. On a re-hit we
    // only refresh re-entry context — never clobber the user's triage (status,
    // area, needsReview). Terminal matches split by intent: `dropped` means the user
    // said no — the key stays suppressed and is never resurrected (docs/06-surfaces.md),
    // even if a done row also exists; `done` falls through to a fresh planned
    // task, so a re-swept thread can become live again after it was completed.
    if (args.dedupeKey) {
      const { matches, open } = await dedupeMatches(ctx, args.dedupeKey);
      if (open) {
        const refresh: Record<string, unknown> = { updatedAt: now };
        if (args.contextLine !== undefined) refresh.contextLine = args.contextLine;
        if (args.sourceRef !== undefined) refresh.sourceRef = args.sourceRef;
        if (args.kickoffPrompt !== undefined) refresh.kickoffPrompt = args.kickoffPrompt;
        await ctx.db.patch(open._id, refresh);
        return { taskId: open._id, created: false };
      }
      const dropped = matches.find((t) => t.status === "dropped");
      if (dropped) {
        return { taskId: dropped._id, created: false };
      }
      if (args.reopenCompleted === false) {
        const completed = [...matches].reverse().find(t => t.status === "done");
        if (completed) return { taskId: completed._id, created: false };
      }
    }

    const areaId = args.areaKey
      ? await resolveAreaId(ctx, args.areaKey)
      : await defaultAreaId(ctx);
    const status = args.status ?? "inbox";

    const taskId = await ctx.db.insert("tasks", {
      title: args.title,
      note: args.note,
      areaId,
      projectId: args.projectId,
      status,
      origin: "planned",
      size: args.size,
      urgent: args.urgent,
      source: args.source ?? "manual",
      sourceRef: args.sourceRef,
      contextLine: args.contextLine,
      kickoffPrompt: args.kickoffPrompt,
      vaultRef: args.vaultRef,
      waitingOn: args.waitingOn,
      waitingSince: status === "waiting" ? now : undefined,
      dueAt: args.dueAt,
      needsReview: args.needsReview,
      dedupeKey: args.dedupeKey,
      updatedAt: now,
    });
    return { taskId, created: true };
  },
});

// ── logCompletion: work that already happened (the distraction catcher) ──────

export const logCompletion = mutation({
  args: {
    ...apiKeyArg,
    title: v.string(),
    note: v.optional(v.string()),
    areaKey: v.optional(v.string()),
    projectId: v.optional(v.id("projects")),
    size: v.optional(sizeValidator),
    source: v.optional(v.string()),
    sourceRef: v.optional(sourceRefValidator),
    contextLine: v.optional(v.string()),
    vaultRef: v.optional(v.string()),
    provisional: v.optional(v.boolean()), // from the SessionEnd hook; evening pass refines
    doneAt: v.optional(v.number()), // default now
    dedupeKey: v.optional(v.string()),
  },
  returns: v.object({ taskId: v.id("tasks"), created: v.boolean() }),
  handler: async (ctx, args) => {
    requireKey(args.apiKey);
    const now = Date.now();

    // "I did the thing you were already tracking": a dedupe match on an OPEN
    // task completes it (docs/06-surfaces.md "Did it") — silently refreshing its note
    // would swallow the completion (it'd never reach dayLog/streak). A closed
    // match — done OR dropped — keeps the old idempotent refresh instead, so a
    // re-fired hook can neither duplicate a completion nor resurrect a
    // provisional the evening reconcile deliberately dropped.
    if (args.dedupeKey) {
      const { matches, open } = await dedupeMatches(ctx, args.dedupeKey);
      if (open) {
        await applyStatus(ctx, open._id, "done", now);
        const refresh: Record<string, unknown> = {};
        if (args.note !== undefined) refresh.note = args.note;
        if (args.contextLine !== undefined) refresh.contextLine = args.contextLine;
        if (args.doneAt !== undefined) refresh.doneAt = args.doneAt;
        if (args.provisional !== undefined) refresh.provisional = args.provisional;
        if (Object.keys(refresh).length) await ctx.db.patch(open._id, refresh);
        return { taskId: open._id, created: false };
      }
      const newestClosed = matches[matches.length - 1]; // the row a re-log refers to
      if (newestClosed) {
        const refresh: Record<string, unknown> = { updatedAt: now };
        if (args.note !== undefined) refresh.note = args.note;
        if (args.contextLine !== undefined) refresh.contextLine = args.contextLine;
        await ctx.db.patch(newestClosed._id, refresh);
        return { taskId: newestClosed._id, created: false };
      }
    }

    const areaId = args.areaKey
      ? await resolveAreaId(ctx, args.areaKey)
      : await defaultAreaId(ctx);

    const taskId = await ctx.db.insert("tasks", {
      title: args.title,
      note: args.note,
      areaId,
      projectId: args.projectId,
      status: "done",
      origin: "adhoc",
      size: args.size,
      source: args.source ?? "manual",
      sourceRef: args.sourceRef,
      contextLine: args.contextLine,
      vaultRef: args.vaultRef,
      doneAt: args.doneAt ?? now,
      provisional: args.provisional,
      dedupeKey: args.dedupeKey,
      updatedAt: now,
    });
    return { taskId, created: true };
  },
});

// ── status verbs ─────────────────────────────────────────────────────────────

export const markDone = mutation({
  args: { ...apiKeyArg, id: v.id("tasks"), note: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, { apiKey, id, note }) => {
    requireKey(apiKey);
    await applyStatus(ctx, id, "done", Date.now());
    // Shift+D "Done + Notes": stash a completion note for future reference.
    if (note !== undefined && note.trim() !== "") {
      await ctx.db.patch(id, { completionNote: note.trim() });
    }
    return null;
  },
});

/** Hide a task until a wake time (no status change — it stays where it sits). */
export const snooze = mutation({
  args: { ...apiKeyArg, id: v.id("tasks"), until: v.number() },
  returns: v.null(),
  handler: async (ctx, { apiKey, id, until }) => {
    requireKey(apiKey);
    const task = await ctx.db.get(id);
    if (!task) throw new ConvexError(`Task ${id} not found.`);
    await ctx.db.patch(id, { snoozeUntil: until, updatedAt: Date.now() });
    return null;
  },
});

/**
 * Stamp when work actually began (first Focus/Now engagement — the glass and
 * MCP call this when a task takes the stage). Idempotent: the first stamp
 * wins, so true active-time is always startedAt→doneAt (docs/06-surfaces.md) and the
 * energy-learning loop gets honest durations.
 */
export const start = mutation({
  args: { ...apiKeyArg, id: v.id("tasks") },
  returns: v.null(),
  handler: async (ctx, { apiKey, id }) => {
    requireKey(apiKey);
    const task = await ctx.db.get(id);
    if (!task) throw new ConvexError(`Task ${id} not found.`);
    if (task.startedAt === undefined) {
      await ctx.db.patch(id, { startedAt: Date.now(), updatedAt: Date.now() });
    }
    return null;
  },
});

/**
 * The snooze-waker (H4 + 4.5): expired snoozes don't just become visible —
 * a woken OPEN task takes the Now slot ("Back as promised", docs/06-surfaces.md):
 * status `today`, head of the morning-checkin order, `wokeAt` stamped so the
 * glass can say why it's leading. Two deliberate exceptions: `waiting` tasks
 * resurface in the waiting pile instead (a timed chase is a poke, and
 * promotion via applyStatus would wipe the ageing clock), and closed tasks
 * just get the stale field cleared. Runs from crons.ts every minute; the
 * gte(1) lower bound keeps the index range clear of the undefined partition.
 */
export const wakeExpired = internalMutation({
  args: {},
  returns: v.object({ woken: v.number(), promoted: v.number() }),
  handler: async (ctx) => {
    const now = Date.now();
    const due = await ctx.db
      .query("tasks")
      .withIndex("by_snooze", (q) => q.gte("snoozeUntil", 1).lte("snoozeUntil", now))
      .collect();

    const promoted: Id<"tasks">[] = [];
    for (const t of due) {
      const patch: Record<string, unknown> = {
        snoozeUntil: undefined,
        wokeAt: now,
        updatedAt: now,
      };
      if (!isClosed(t) && t.status !== "waiting") {
        patch.status = "today";
        promoted.push(t._id);
      }
      await ctx.db.patch(t._id, patch);
    }

    // Head of the Now order: prepend to today's morning-checkin `chosen`
    // (computeToday reads it first). Created machine-authored if absent —
    // chosen IS the Now order, however it came to be.
    if (promoted.length) {
      const settings = await readSettings(ctx);
      const today = dateString(now, settings.timezone);
      const checkins = await ctx.db
        .query("checkins")
        .withIndex("by_date", (q) => q.eq("date", today))
        .collect();
      const morning = checkins.find((c) => c.kind === "morning");
      if (morning) {
        const rest = morning.chosen.filter((id) => !promoted.includes(id));
        await ctx.db.patch(morning._id, { chosen: [...promoted, ...rest] });
      } else {
        await ctx.db.insert("checkins", {
          date: today,
          kind: "morning",
          chosen: promoted,
          completedPlanned: [],
          completedAdhoc: [],
          carried: [],
        });
      }
    }
    return { woken: due.length, promoted: promoted.length };
  },
});

/** Un-snooze: clear the wake time so the task returns to its surfaces now. */
export const wake = mutation({
  args: { ...apiKeyArg, id: v.id("tasks") },
  returns: v.null(),
  handler: async (ctx, { apiKey, id }) => {
    requireKey(apiKey);
    const task = await ctx.db.get(id);
    if (!task) throw new ConvexError(`Task ${id} not found.`);
    // Convex db.patch removes fields set to undefined.
    await ctx.db.patch(id, { snoozeUntil: undefined, updatedAt: Date.now() });
    return null;
  },
});

/** No-guilt deferral: push to next/someday/waiting/… */
export const defer = mutation({
  args: { ...apiKeyArg, id: v.id("tasks"), status: statusValidator },
  returns: v.null(),
  handler: async (ctx, { apiKey, id, status }) => {
    requireKey(apiKey);
    await applyStatus(ctx, id, status, Date.now());
    return null;
  },
});

/** Generic status set with the same honest timestamp side-effects. */
export const setStatus = mutation({
  args: { ...apiKeyArg, id: v.id("tasks"), status: statusValidator },
  returns: v.null(),
  handler: async (ctx, { apiKey, id, status }) => {
    requireKey(apiKey);
    await applyStatus(ctx, id, status, Date.now());
    return null;
  },
});

/** Escape hatch: patch arbitrary editable fields. areaKey resolves to areaId. */
export const update = mutation({
  args: {
    ...apiKeyArg,
    id: v.id("tasks"),
    title: v.optional(v.string()),
    note: v.optional(v.string()),
    areaKey: v.optional(v.string()),
    projectId: v.optional(v.id("projects")),
    size: v.optional(sizeValidator),
    urgent: v.optional(v.boolean()),
    contextLine: v.optional(v.string()),
    kickoffPrompt: v.optional(v.string()),
    vaultRef: v.optional(v.string()),
    waitingOn: v.optional(v.string()),
    dueAt: v.optional(v.number()),
    snoozeUntil: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    requireKey(args.apiKey);
    // apiKey is auth, not data — it must never land in the patch below.
    const { apiKey: _apiKey, id, areaKey, ...rest } = args;
    const task = await ctx.db.get(id);
    if (!task) throw new ConvexError(`Task ${id} not found.`);
    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    for (const [k, val] of Object.entries(rest)) {
      if (val !== undefined) patch[k] = val;
    }
    if (areaKey !== undefined) patch.areaId = await resolveAreaId(ctx, areaKey);
    await ctx.db.patch(id, patch);
    return null;
  },
});

/**
 * Delegate (slice 4.6, D11) — get things off the user's plate in one gesture.
 * Two-sided: every open selected task moves to `waiting` with
 * `waitingOn: <person>` (it leaves the actionable queue immediately — that's
 * the point), and ONE small task is minted to actually do the delegating —
 * on `today`, xs, with a kickoffPrompt that drafts the handover. Follow-up
 * comes free from the existing waiting/ageing/chase machinery. Closed tasks
 * in the selection are skipped; an all-closed selection is an error.
 */
export const delegate = mutation({
  args: {
    ...apiKeyArg,
    taskIds: v.array(v.id("tasks")),
    person: v.optional(v.string()),
    note: v.optional(v.string()),
    dedupeKey: v.optional(v.string()), // idempotency/cleanup handle for the minted task
  },
  returns: v.object({ delegationTaskId: v.id("tasks"), delegated: v.number() }),
  handler: async (ctx, { apiKey, taskIds, person, note, dedupeKey }) => {
    requireKey(apiKey);
    const now = Date.now();
    const settings = await readSettings(ctx);
    const who = person ?? "someone";

    const handedOver: Doc<"tasks">[] = [];
    for (const id of taskIds) {
      const task = await ctx.db.get(id);
      if (!task || isClosed(task)) continue;
      await applyStatus(ctx, id, "waiting", now); // stamps waitingSince
      await ctx.db.patch(id, { waitingOn: who });
      handedOver.push(task);
    }
    if (handedOver.length === 0) {
      throw new ConvexError("delegate: nothing open to delegate in the selection.");
    }

    const titles = handedOver.map((t) => t.title);
    const summary =
      titles.length === 1
        ? titles[0]
        : `${titles[0]} (+${titles.length - 1} more)`;
    const delegationTaskId = await ctx.db.insert("tasks", {
      title: `Delegate: ${summary} → ${who}`,
      note:
        `Hand over to ${who}:\n${titles.map((t) => `• ${t}`).join("\n")}` +
        (note ? `\n\n${note}` : ""),
      areaId: handedOver[0].areaId, // the work's own area, not a default bucket
      status: "today",
      origin: "planned",
      size: "xs", // telling someone is a two-minute win
      source: "delegate",
      contextLine: `${titles.length} task${titles.length > 1 ? "s" : ""} parked on ${who} — they're waiting on the handover.`,
      kickoffPrompt:
        `Draft a short, warm handover message to ${who} covering: ${titles.join("; ")}. ` +
        `Include what "done" looks like for each and when it is needed. Tone: ${settings.owner.tone}.`,
      dedupeKey,
      updatedAt: now,
    });
    return { delegationTaskId, delegated: handedOver.length };
  },
});

// ── merge + connect (Phase 5, docs/03-data-model.md) ───────────────────────────────────────

/**
 * Merge a true duplicate into its survivor (docs/03-data-model.md). Direction is the
 * caller's choice — the glass defaults target = the older row so the original
 * added-date (immutable `_creationTime`) is preserved for free.
 *
 * Folds source → target: context unioned (target's wins; source fills gaps;
 * differing notes concatenate rather than vanish), provenance stashed on
 * `mergedFrom[]` (source's own merge history carried too, so chains stay
 * traceable), the source's dedupeKey + aliases pushed onto `dedupeAliases[]`,
 * and `links[]` migrated with each neighbour re-pointed at the target (the
 * symmetric-adjacency invariant survives). The source is dropped with a
 * `mergedInto` pointer — dedupeMatches follows it, so a re-sweep of the
 * source's thread refreshes the target instead of minting the dupe again.
 */
export const merge = mutation({
  args: { ...apiKeyArg, sourceId: v.id("tasks"), targetId: v.id("tasks") },
  returns: v.object({ targetId: v.id("tasks") }),
  handler: async (ctx, { apiKey, sourceId, targetId }) => {
    requireKey(apiKey);
    if (sourceId === targetId) throw new ConvexError("merge: a task can't merge into itself.");
    const source = await ctx.db.get(sourceId);
    const target = await ctx.db.get(targetId);
    if (!source) throw new ConvexError(`Task ${sourceId} not found.`);
    if (!target) throw new ConvexError(`Task ${targetId} not found.`);
    // Closed rows are out of play: merging INTO one would bury live work, and a
    // closed source is already resolved — nothing to collapse.
    if (isClosed(source)) throw new ConvexError("merge: source is already done/dropped.");
    if (isClosed(target)) throw new ConvexError("merge: target is done/dropped — merge into an open task.");
    const now = Date.now();

    const patch: Record<string, unknown> = { updatedAt: now };

    // Union the context: target's wins, source fills the gaps. Two differing
    // notes both survive (concatenated) — a merge must never lose written context.
    if (source.note !== undefined) {
      if (target.note === undefined) patch.note = source.note;
      else if (target.note !== source.note) {
        patch.note = `${target.note}\n\n— merged from "${source.title}":\n${source.note}`;
      }
    }
    if (target.contextLine === undefined && source.contextLine !== undefined)
      patch.contextLine = source.contextLine;
    if (target.kickoffPrompt === undefined && source.kickoffPrompt !== undefined)
      patch.kickoffPrompt = source.kickoffPrompt;
    if (target.sourceRef === undefined && source.sourceRef !== undefined)
      patch.sourceRef = source.sourceRef;
    // A deadline on the dupe is real information — never silently lose it.
    if (target.dueAt === undefined && source.dueAt !== undefined) patch.dueAt = source.dueAt;

    // Provenance: the source (and everything IT had absorbed) onto mergedFrom[].
    patch.mergedFrom = [
      ...(target.mergedFrom ?? []),
      ...(source.mergedFrom ?? []),
      { title: source.title, sourceRef: source.sourceRef, dedupeKey: source.dedupeKey },
    ];

    // Re-sweep safety: the source's key(s) become aliases of the target.
    const aliases = new Set(target.dedupeAliases ?? []);
    for (const k of [...(source.dedupeAliases ?? []), source.dedupeKey]) {
      if (k !== undefined && k !== target.dedupeKey) aliases.add(k);
    }
    if (aliases.size) patch.dedupeAliases = [...aliases];

    // Migrate links, keeping adjacency symmetric: every neighbour that pointed
    // at the source now points at the target; a source↔target edge dissolves.
    const targetLinks = new Set(target.links ?? []);
    targetLinks.delete(sourceId);
    for (const nId of source.links ?? []) {
      if (nId === targetId) continue;
      const n = await ctx.db.get(nId);
      if (!n) continue;
      const nLinks = new Set(n.links ?? []);
      nLinks.delete(sourceId);
      nLinks.add(targetId);
      await ctx.db.patch(nId, { links: [...nLinks], updatedAt: now });
      targetLinks.add(nId);
    }
    if (targetLinks.size) patch.links = [...targetLinks];
    else if (target.links !== undefined) patch.links = undefined; // a dissolved source↔target edge leaves no empty husk

    // A confirmed duplicate confirms the proposal: if the target still awaits
    // one-tap confirm but the source was already accepted, the merge IS the confirm.
    if (target.needsReview && !source.needsReview) patch.needsReview = false;

    await ctx.db.patch(targetId, patch);

    // Drop the source — traceable, not lost. applyStatus keeps the flag
    // side-effects honest (needsReview cleared etc.); links are gone from play.
    await applyStatus(ctx, sourceId, "dropped", now);
    await ctx.db.patch(sourceId, { mergedInto: targetId, links: undefined });

    return { targetId };
  },
});

/**
 * Connect two related-but-distinct tasks (docs/03-data-model.md): symmetric adjacency via
 * `links[]` on each side. Idempotent — connecting an existing pair is a no-op.
 * Closed tasks may be linked (context is context); clusters emerge as
 * connected components, no group entity to manage.
 */
export const connect = mutation({
  args: { ...apiKeyArg, aId: v.id("tasks"), bId: v.id("tasks") },
  returns: v.null(),
  handler: async (ctx, { apiKey, aId, bId }) => {
    requireKey(apiKey);
    if (aId === bId) throw new ConvexError("connect: a task can't link to itself.");
    const a = await ctx.db.get(aId);
    const b = await ctx.db.get(bId);
    if (!a) throw new ConvexError(`Task ${aId} not found.`);
    if (!b) throw new ConvexError(`Task ${bId} not found.`);
    const now = Date.now();
    if (!(a.links ?? []).includes(bId)) {
      await ctx.db.patch(aId, { links: [...(a.links ?? []), bId], updatedAt: now });
    }
    if (!(b.links ?? []).includes(aId)) {
      await ctx.db.patch(bId, { links: [...(b.links ?? []), aId], updatedAt: now });
    }
    return null;
  },
});

/** Remove a connection from both sides. Idempotent — a missing edge is a no-op. */
export const disconnect = mutation({
  args: { ...apiKeyArg, aId: v.id("tasks"), bId: v.id("tasks") },
  returns: v.null(),
  handler: async (ctx, { apiKey, aId, bId }) => {
    requireKey(apiKey);
    const now = Date.now();
    for (const [id, otherId] of [[aId, bId], [bId, aId]] as const) {
      const t = await ctx.db.get(id);
      if (t && (t.links ?? []).includes(otherId)) {
        const rest = t.links!.filter((l) => l !== otherId);
        // A last-edge removal drops the field entirely (matches merge — no empty husk).
        await ctx.db.patch(id, { links: rest.length ? rest : undefined, updatedAt: now });
      }
    }
    return null;
  },
});

/** One-tap confirm of a sweep-proposed task — clears needsReview. */
export const confirmProposed = mutation({
  args: { ...apiKeyArg, id: v.id("tasks") },
  returns: v.null(),
  handler: async (ctx, { apiKey, id }) => {
    requireKey(apiKey);
    const task = await ctx.db.get(id);
    if (!task) throw new ConvexError(`Task ${id} not found.`);
    await ctx.db.patch(id, { needsReview: false, updatedAt: Date.now() });
    return null;
  },
});
