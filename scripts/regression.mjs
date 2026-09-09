#!/usr/bin/env node
/**
 * Helm regression harness (slice H2) — `npm test`.
 *
 * Runs the committed behavioural suite against the DEV deployment (CONVEX_URL
 * from .env.local), the same brain the MCP talks to. Design rules:
 *
 *  - Every task fixture carries a dedupeKey under PREFIX; check-in fixtures
 *    pin to SAFE_DATE (a pre-Helm date). `testing:purgeTestData` (internal,
 *    admin-only via `npx convex run`) deletes exactly that footprint before
 *    and after the run — including after failures.
 *  - Assertions are DELTA-based or property-based, never absolute counts, so
 *    real data in dev can't flake them. Fixtures are visible on live surfaces
 *    for the seconds the suite runs; that's accepted (dev-first, docs/CLAUDE).
 *
 * Covers: capture defaults + dedupe semantics (incl. H1: dropped-suppression,
 * done-resurrection, multi-row keys), logCompletion (incl. H1: open-match
 * completes), status-verb side-effects, read API invariants, London
 * day-boundary via backdated completions, past-date check-ins.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { development } from "./lib/dev.mjs";
import { AREA_PRESETS, validateAreas } from "./lib/areas.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PREFIX = "test:reg:";
const SAFE_DATE = "2026-01-15"; // pre-Helm London day — no real data can live here
const SAFE_NOON = Date.UTC(2026, 0, 15, 12); // London == UTC in January
const SAFE_DATE2 = "2026-01-20"; // second pre-Helm day for the H5 healing tests
const SAFE_NOON2 = Date.UTC(2026, 0, 20, 12);

// ── plumbing ─────────────────────────────────────────────────────────────────

const envLocal = readFileSync(join(ROOT, ".env.local"), "utf8");
const CONVEX_URL = envLocal.match(/^CONVEX_URL=(.+)$/m)?.[1]?.trim();
if (!CONVEX_URL) {
  console.error("regression: CONVEX_URL not found in .env.local");
  process.exit(1);
}
const client = new ConvexHttpClient(CONVEX_URL);

// Function-level auth (4.1, D15): every public function takes `apiKey`.
// Fetched via the admin CLI at runtime so it's never committed or printed.
let API_KEY = "";
try {
  API_KEY = execFileSync("npx", ["convex", "env", "get", "HELM_API_KEY"], {
    cwd: ROOT, encoding: "utf8",
  }).trim();
} catch { /* unset → calls go keyless; enforcement section skips */ }
const withKey = (args) => (API_KEY ? { apiKey: API_KEY, ...args } : args);
const q = (name, args = {}) => client.query(makeFunctionReference(name), withKey(args));
const m = (name, args = {}) => client.mutation(makeFunctionReference(name), withKey(args));

function purge() {
  const out = execFileSync(
    "npx",
    ["convex", "run", "testing:purgeTestData", JSON.stringify({ prefix: PREFIX, dates: [SAFE_DATE, SAFE_DATE2] })],
    { cwd: ROOT, encoding: "utf8" },
  );
  return JSON.parse(out);
}

let passed = 0;
const failures = [];
function assert(cond, name, detail = "") {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failures.push(name);
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}
async function throws(fn, name) {
  try {
    await fn();
    assert(false, name, "expected a throw");
  } catch {
    assert(true, name);
  }
}
const key = (s) => `${PREFIX}${s}`;

// ── suite ────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`regression → ${CONVEX_URL}`);
  purge(); // clear any residue from a previous failed run

  // ── A · capture basics ──
  console.log("\nA · capture basics");
  const a1 = await m("tasks:capture", { title: "TEST capture minimal", dedupeKey: key("a1") });
  assert(a1.created === true, "capture: fresh key creates");
  const a1doc = await q("tasks:get", { id: a1.taskId });
  assert(a1doc.status === "inbox", "capture: default status inbox");
  assert(a1doc.origin === "planned", "capture: origin planned");
  assert(a1doc.source === "manual", "capture: default source manual");
  assert(typeof a1doc.areaId === "string", "capture: default area resolved");

  const a2 = await m("tasks:capture", {
    title: "TEST waiting stamp", dedupeKey: key("a2"),
    areaKey: "finance", status: "waiting", waitingOn: "Sam",
  });
  const a2doc = await q("tasks:get", { id: a2.taskId });
  assert(a2doc.waitingSince !== undefined, "capture: status waiting stamps waitingSince");
  assert(a2doc.waitingOn === "Sam", "capture: waitingOn stored");

  await throws(() => m("tasks:capture", { title: "TEST bad area", dedupeKey: key("a3"), areaKey: "nope" }),
    "capture: unknown areaKey throws (no silent mis-file)");
  await throws(() => m("tasks:capture", { title: "TEST done mint", dedupeKey: key("a4"), status: "done" }),
    "capture: status done rejected (completions only via logCompletion)");

  // ── B · capture dedupe (incl. H1a) ──
  console.log("\nB · capture dedupe (H1a)");
  const b1 = await m("tasks:capture", {
    title: "TEST dedupe base", dedupeKey: key("b1"), needsReview: true, contextLine: "v1",
  });
  const b1again = await m("tasks:capture", {
    title: "TEST dedupe re-hit", dedupeKey: key("b1"), contextLine: "v2", status: "today",
  });
  assert(b1again.created === false && b1again.taskId === b1.taskId, "dedupe: re-hit returns same row");
  const b1doc = await q("tasks:get", { id: b1.taskId });
  assert(b1doc.contextLine === "v2", "dedupe: re-entry context refreshed");
  assert(b1doc.status === "inbox", "dedupe: triage (status) not clobbered");
  assert(b1doc.needsReview === true, "dedupe: needsReview not clobbered");
  assert(b1doc.title === "TEST dedupe base", "dedupe: title not clobbered");

  // H1a: dropped stays suppressed
  await m("tasks:setStatus", { id: b1.taskId, status: "dropped" });
  const b1dropped = await m("tasks:capture", {
    title: "TEST resurrect attempt", dedupeKey: key("b1"), contextLine: "v3",
  });
  assert(b1dropped.created === false && b1dropped.taskId === b1.taskId,
    "H1a: dropped match suppresses re-proposal (no new row)");
  const b1post = await q("tasks:get", { id: b1.taskId });
  assert(b1post.status === "dropped" && b1post.contextLine === "v2",
    "H1a: dropped row untouched (not resurrected, not refreshed)");

  // H1a: done falls through to a fresh task…
  const b2 = await m("tasks:capture", { title: "TEST done cycle", dedupeKey: key("b2") });
  await m("tasks:markDone", { id: b2.taskId });
  const b2res = await m("tasks:capture", { title: "TEST done cycle 2", dedupeKey: key("b2") });
  assert(b2res.created === true && b2res.taskId !== b2.taskId, "H1a: done match resurrects as a fresh task");
  // …and the multi-row key then dedupes against the LIVE row, not the old done one
  const b2third = await m("tasks:capture", { title: "TEST done cycle 3", dedupeKey: key("b2") });
  assert(b2third.created === false && b2third.taskId === b2res.taskId,
    "H1a: multi-row key matches the live row (no duplicate minting)");

  // ── C · logCompletion (incl. H1b) ──
  console.log("\nC · logCompletion (H1b)");
  const c1 = await m("tasks:logCompletion", { title: "TEST adhoc done", dedupeKey: key("c1") });
  const c1doc = await q("tasks:get", { id: c1.taskId });
  assert(c1.created === true && c1doc.status === "done" && c1doc.origin === "adhoc" && c1doc.doneAt !== undefined,
    "logCompletion: fresh key → adhoc done with doneAt");
  const c1again = await m("tasks:logCompletion", { title: "TEST adhoc re-log", dedupeKey: key("c1"), note: "n2" });
  const c1doc2 = await q("tasks:get", { id: c1.taskId });
  assert(c1again.created === false && c1doc2.doneAt === c1doc.doneAt && c1doc2.note === "n2",
    "logCompletion: closed re-log idempotent (doneAt fixed, note refreshed)");

  // H1b: open planned match gets COMPLETED, not silently refreshed
  const c2 = await m("tasks:capture", {
    title: "TEST tracked then did it", dedupeKey: key("c2"),
    status: "waiting", waitingOn: "Bob", needsReview: true,
  });
  const c2done = await m("tasks:logCompletion", { title: "irrelevant", dedupeKey: key("c2"), note: "did it" });
  const c2doc = await q("tasks:get", { id: c2.taskId });
  assert(c2done.created === false && c2done.taskId === c2.taskId, "H1b: open match reused, not duplicated");
  assert(c2doc.status === "done" && c2doc.doneAt !== undefined, "H1b: open match completed (doneAt stamped)");
  assert(c2doc.origin === "planned", "H1b: origin stays planned (it WAS planned work)");
  assert(c2doc.waitingSince === undefined, "H1b: waiting clock cleared on completion");
  assert(c2doc.needsReview === false, "H1b: review flag cleared on completion");
  const c2re = await m("tasks:logCompletion", { title: "irrelevant", dedupeKey: key("c2") });
  const c2doc2 = await q("tasks:get", { id: c2.taskId });
  assert(c2re.created === false && c2doc2.doneAt === c2doc.doneAt,
    "H1b: second log is idempotent (doneAt unmoved)");

  // H1b: backdated completion of a tracked task lands in the right London day
  const before = await q("queries:dayLog", { date: SAFE_DATE });
  const c3 = await m("tasks:capture", { title: "TEST backdate me", dedupeKey: key("c3") });
  await m("tasks:logCompletion", { title: "irrelevant", dedupeKey: key("c3"), doneAt: SAFE_NOON });
  const after = await q("queries:dayLog", { date: SAFE_DATE });
  assert(after.counts.planned === before.counts.planned + 1,
    "H1b: backdated doneAt honoured (dayLog planned +1 on that London day)");
  const c4 = await m("tasks:logCompletion", {
    title: "TEST backdated adhoc", dedupeKey: key("c4"), doneAt: SAFE_NOON + 1000,
  });
  const after2 = await q("queries:dayLog", { date: SAFE_DATE });
  assert(after2.counts.adhoc === before.counts.adhoc + 1, "dayLog: backdated adhoc lands in day bucket");
  assert(after2.counts.total === before.counts.total + 2, "dayLog: totals reconcile");

  // logCompletion on a DROPPED match: an explicit no survives re-fires — the
  // row is refreshed, never resurrected, and no new completion is minted
  // (protects reconcile-dropped provisionals from re-firing hooks).
  const c5 = await m("tasks:capture", { title: "TEST dropped then logged", dedupeKey: key("c5") });
  await m("tasks:setStatus", { id: c5.taskId, status: "dropped" });
  const c5log = await m("tasks:logCompletion", { title: "irrelevant", dedupeKey: key("c5"), note: "refire" });
  const c5doc = await q("tasks:get", { id: c5.taskId });
  assert(c5log.created === false && c5log.taskId === c5.taskId && c5doc.status === "dropped"
    && c5doc.doneAt === undefined && c5doc.note === "refire",
    "logCompletion: dropped match refreshed, never resurrected or completed");

  // ── D · status verbs ──
  console.log("\nD · status verbs");
  const d1 = await m("tasks:capture", { title: "TEST verbs", dedupeKey: key("d1") });
  await m("tasks:markDone", { id: d1.taskId });
  const d1doc = await q("tasks:get", { id: d1.taskId });
  assert(d1doc.origin === "planned" && d1doc.doneAt !== undefined, "markDone: keeps origin planned, stamps doneAt");
  await m("tasks:markDone", { id: d1.taskId });
  const d1doc2 = await q("tasks:get", { id: d1.taskId });
  assert(d1doc2.doneAt === d1doc.doneAt, "markDone: re-mark doesn't move the clock");

  // Reopen un-completes (doneAt cleared — the Z-undo contract); re-completing
  // restamps to the day it actually happened, not the day it was first done.
  await m("tasks:setStatus", { id: d1.taskId, status: "inbox" });
  const d1re = await q("tasks:get", { id: d1.taskId });
  assert(d1re.doneAt === undefined, "reopen: clears doneAt (un-completes — the Z-undo contract)");
  await new Promise((r) => setTimeout(r, 5));
  await m("tasks:markDone", { id: d1.taskId });
  const d1doc3 = await q("tasks:get", { id: d1.taskId });
  assert(d1doc3.doneAt > d1doc.doneAt, "reopen→re-complete: doneAt restamps to the new completion");

  const d2 = await m("tasks:capture", { title: "TEST snooze", dedupeKey: key("d2") });
  const wakeAt = Date.now() + 3600_000;
  await m("tasks:snooze", { id: d2.taskId, until: wakeAt });
  assert((await q("tasks:get", { id: d2.taskId })).snoozeUntil === wakeAt, "snooze: sets snoozeUntil");
  const dList = await q("queries:list", { status: "inbox", limit: 200 });
  assert(!dList.some((t) => t._id === d2.taskId), "list: snoozed hidden by default");
  const dListInc = await q("queries:list", { status: "inbox", includeSnoozed: true, limit: 200 });
  assert(dListInc.some((t) => t._id === d2.taskId), "list: includeSnoozed reveals");
  await m("tasks:wake", { id: d2.taskId });
  assert((await q("tasks:get", { id: d2.taskId })).snoozeUntil === undefined, "wake: clears snoozeUntil");

  const d3 = await m("tasks:capture", { title: "TEST wait cycle", dedupeKey: key("d3") });
  await m("tasks:defer", { id: d3.taskId, status: "waiting" });
  const d3a = await q("tasks:get", { id: d3.taskId });
  assert(d3a.waitingSince !== undefined, "defer→waiting: stamps waitingSince");
  await m("tasks:setStatus", { id: d3.taskId, status: "next" });
  const d3b = await q("tasks:get", { id: d3.taskId });
  assert(d3b.waitingSince === undefined, "leave waiting: clears the clock (no stale ageing)");

  // ── D2 · snooze-waker returns-to-Now (H4 + 4.5) ──
  console.log("\nD2 · snooze-waker returns-to-Now (H4 + 4.5)");
  const todayLondon = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" });
  const priorMorning = await q("checkins:getCheckin", { date: todayLondon, kind: "morning" });
  try {
    const w1 = await m("tasks:capture", { title: "TEST wake me", dedupeKey: key("w1") });
    const w2 = await m("tasks:capture", { title: "TEST still parked", dedupeKey: key("w2") });
    const w3 = await m("tasks:capture", {
      title: "TEST timed chase", dedupeKey: key("w3"), status: "waiting", waitingOn: "Sam",
    });
    await m("tasks:snooze", { id: w1.taskId, until: Date.now() - 1000 }); // already due
    await m("tasks:snooze", { id: w2.taskId, until: Date.now() + 3600_000 }); // due in an hour
    await m("tasks:snooze", { id: w3.taskId, until: Date.now() - 1000 }); // due chase
    const wakeOut = JSON.parse(execFileSync(
      "npx", ["convex", "run", "tasks:wakeExpired"], { cwd: ROOT, encoding: "utf8" },
    ));
    // The LIVE per-minute cron may race this manual run and wake the fixtures
    // first — so assert observed state below, not who did the waking.
    assert(typeof wakeOut.woken === "number" && typeof wakeOut.promoted === "number",
      "waker: runs and reports counts");
    const w1doc = await q("tasks:get", { id: w1.taskId });
    const w2doc = await q("tasks:get", { id: w2.taskId });
    const w3doc = await q("tasks:get", { id: w3.taskId });
    assert(w1doc.snoozeUntil === undefined, "waker: expired snooze cleared");
    assert(w2doc.snoozeUntil !== undefined, "waker: future snooze untouched");
    // 4.5: back as promised — the woken task TAKES the Now slot
    assert(w1doc.status === "today" && typeof w1doc.wokeAt === "number",
      "waker: woken open task promoted to today with wokeAt stamped");
    const pick = await q("queries:todaysPick", {});
    assert(pick && pick._id === w1.taskId, "waker: woken task leads todaysPick (Back as promised)");
    // A timed chase resurfaces in the waiting pile — it doesn't fake actionability
    assert(w3doc.status === "waiting" && w3doc.waitingSince !== undefined
      && typeof w3doc.wokeAt === "number",
      "waker: woken waiting task stays a chase (ageing clock intact)");
    const nowChosen = await q("checkins:getCheckin", { date: todayLondon, kind: "morning" });
    assert(nowChosen.chosen[0] === w1.taskId && !nowChosen.chosen.includes(w3.taskId),
      "waker: promoted task heads the morning order; the chase doesn't");
  } finally {
    // Restore the real morning check-in order (fixtures purge; order shouldn't drift)
    await m("checkins:upsertCheckin", {
      date: todayLondon, kind: "morning", chosen: priorMorning?.chosen ?? [],
    });
  }

  const w1r = await m("tasks:capture", { title: "TEST re-capture w1", dedupeKey: key("w1") });
  await m("tasks:setStatus", { id: w1r.taskId, status: "inbox" }); // park fixtures out of the live Now

  const s1 = await m("tasks:capture", { title: "TEST start me", dedupeKey: key("s1") });
  await m("tasks:start", { id: s1.taskId });
  const s1doc = await q("tasks:get", { id: s1.taskId });
  assert(typeof s1doc.startedAt === "number", "start: stamps startedAt");
  await new Promise((r) => setTimeout(r, 5));
  await m("tasks:start", { id: s1.taskId });
  const s1doc2 = await q("tasks:get", { id: s1.taskId });
  assert(s1doc2.startedAt === s1doc.startedAt, "start: idempotent (first stamp wins)");
  await m("tasks:markDone", { id: s1.taskId });
  const s1doc3 = await q("tasks:get", { id: s1.taskId });
  assert(s1doc3.startedAt === s1doc.startedAt && s1doc3.doneAt >= s1doc3.startedAt,
    "start: active-time seam intact (startedAt ≤ doneAt survives completion)");

  // ── E · read API invariants ──
  console.log("\nE · read API invariants");
  const e1 = await m("tasks:capture", {
    title: "TEST proposed", dedupeKey: key("e1"), needsReview: true, size: "xs",
  });
  const inbox1 = await q("queries:inbox", {});
  assert(inbox1.some((t) => t._id === e1.taskId), "inbox: proposed task listed");
  const brief = await q("queries:brief", {});
  assert(brief.counts.inbox === inbox1.length, "brief: review badge ≡ inbox list (no drift)");
  assert(brief.today.length <= 3, "brief: today capped at 3");
  assert(brief.wins.every((t) => t.size === "xs"), "brief: wins are all xs");
  assert(typeof brief.streak === "number" && brief.streak >= 0, "brief: streak is a sane number");
  assert(brief.pick === null || typeof brief.pick.title === "string", "brief: pick is null or a task view");
  assert(brief.today.every((t) => t.area && t.area.key), "brief: views hydrated with area");

  await m("tasks:confirmProposed", { id: e1.taskId });
  const inbox2 = await q("queries:inbox", {});
  assert(!inbox2.some((t) => t._id === e1.taskId), "confirmProposed: clears from inbox");

  const e2 = await m("tasks:capture", { title: "TEST closed proposal", dedupeKey: key("e2"), needsReview: true });
  await m("tasks:setStatus", { id: e2.taskId, status: "dropped" });
  assert(!(await q("queries:inbox", {})).some((t) => t._id === e2.taskId), "inbox: closed proposals excluded");

  const eLim = await q("queries:list", { status: "inbox", limit: 1 });
  assert(eLim.length <= 1, "list: limit respected");
  const eArea = await q("queries:list", { areaKey: "finance", limit: 200 });
  assert(eArea.every((t) => t.area.key === "finance"), "list: area filter exact");

  // ── F · past-date check-ins (real data untouched) ──
  console.log("\nF · check-ins on a past date");
  const f1 = await m("tasks:capture", { title: "TEST choose me", dedupeKey: key("f1") });
  const fDone = await m("tasks:logCompletion", { title: "TEST already done", dedupeKey: key("f2") });
  await m("checkins:chooseToday", { taskIds: [f1.taskId, fDone.taskId], date: SAFE_DATE });
  const fMorning = await q("checkins:getCheckin", { date: SAFE_DATE, kind: "morning" });
  assert(fMorning.chosen.length === 1 && fMorning.chosen[0] === f1.taskId,
    "chooseToday: records only promotable picks (closed excluded)");
  assert((await q("tasks:get", { id: f1.taskId })).status === "today", "chooseToday: promotes to today");
  const fRec = await m("checkins:reconcileDay", { date: SAFE_DATE });
  const fLog = await q("queries:dayLog", { date: SAFE_DATE });
  assert(fRec.completedPlanned === fLog.counts.planned && fRec.completedAdhoc === fLog.counts.adhoc,
    "reconcileDay: counts ≡ dayLog for the same day");
  assert(typeof fRec.confirmed === "number", "reconcileDay: reports confirmed provisionals");
  const fEvening = await q("checkins:getCheckin", { date: SAFE_DATE, kind: "evening" });
  assert(fEvening !== null && fEvening.kind === "evening", "reconcileDay: evening check-in written");

  // ── F2 · self-healing reconcile (H5) ──
  console.log("\nF2 · self-healing reconcile (H5)");
  // Dropped noise leaves the day's numbers entirely (doneAt survives a drop).
  const g0 = await q("queries:dayLog", { date: SAFE_DATE2 });
  const g1 = await m("tasks:logCompletion", {
    title: "TEST noise to drop", dedupeKey: key("g1"), doneAt: SAFE_NOON2,
  });
  await m("tasks:setStatus", { id: g1.taskId, status: "dropped" });
  const g0after = await q("queries:dayLog", { date: SAFE_DATE2 });
  assert(g0after.counts.total === g0.counts.total,
    "dayLog: dropped completions excluded (noise really disappears)");

  // A missed day heals: provisional + real completion, no evening check-in.
  const g2 = await m("tasks:logCompletion", {
    title: "TEST provisional rabbit-hole", dedupeKey: key("g2"),
    provisional: true, doneAt: SAFE_NOON2 + 1000,
  });
  await m("tasks:logCompletion", {
    title: "TEST real adhoc", dedupeKey: key("g3"), doneAt: SAFE_NOON2 + 2000,
  });
  assert((await q("checkins:getCheckin", { date: SAFE_DATE2, kind: "evening" })) === null,
    "healing precondition: the day was never closed");
  const heal = await m("checkins:reconcileOutstanding", { dates: [SAFE_DATE2] });
  assert(heal.reconciled.includes(SAFE_DATE2) && heal.healed >= 1,
    "reconcileOutstanding: backfills the missed day and confirms provisionals");
  const g2doc = await q("tasks:get", { id: g2.taskId });
  assert(g2doc.provisional === undefined, "reconcileOutstanding: provisional flag cleared (confirmed)");
  const g2evening = await q("checkins:getCheckin", { date: SAFE_DATE2, kind: "evening" });
  assert(g2evening !== null && g2evening.carried.length === 0,
    "reconcileOutstanding: backfilled day carries nothing (unknowable in hindsight)");
  assert(g2evening.completedAdhoc.length === 2, "reconcileOutstanding: both real completions recorded");

  // An already-closed day heals WITHOUT clobbering its historical carried.
  const beforeCarried = JSON.stringify(fEvening.carried);
  const g4 = await m("tasks:logCompletion", {
    title: "TEST late provisional", dedupeKey: key("g4"),
    provisional: true, doneAt: SAFE_NOON + 3000,
  });
  const heal2 = await m("checkins:reconcileOutstanding", { dates: [SAFE_DATE] });
  assert(!heal2.reconciled.includes(SAFE_DATE) && heal2.healed >= 1,
    "reconcileOutstanding: already-closed day heals without a new check-in");
  assert((await q("tasks:get", { id: g4.taskId })).provisional === undefined,
    "reconcileOutstanding: late provisional confirmed on a closed day");
  const fEvening2 = await q("checkins:getCheckin", { date: SAFE_DATE, kind: "evening" });
  assert(JSON.stringify(fEvening2.carried) === beforeCarried,
    "reconcileOutstanding: historical carried preserved (no live clobber)");

  // ── F3 · brief waiting cap (H6) ──
  console.log("\nF3 · brief waiting cap (H6)");
  for (let i = 0; i < 12; i++) {
    await m("tasks:capture", {
      title: `TEST waiting wall ${i}`, dedupeKey: key(`wall${i}`),
      status: "waiting", waitingOn: "someone",
    });
  }
  const capBrief = await q("queries:brief", {});
  assert(capBrief.waiting.length <= 10, "brief: waiting capped at 10 (never a wall)");
  assert(capBrief.counts.waiting > capBrief.waiting.length,
    "brief: counts.waiting stays the true total beyond the cap");
  const fullWaiting = await q("queries:waiting", {});
  assert(capBrief.counts.waiting === fullWaiting.length,
    "brief: counts.waiting ≡ the uncapped waiting query");

  // The streak only trusts confirmed completions: a raw provisional today moves nothing.
  const streakBefore = (await q("queries:brief", {})).streak;
  await m("tasks:logCompletion", {
    title: "TEST provisional today", dedupeKey: key("g5"), provisional: true,
  });
  const streakAfter = (await q("queries:brief", {})).streak;
  assert(streakAfter === streakBefore, "streak: unconfirmed provisional doesn't move it");

  // ── H · token-guarded HTTP surface (H3 hardening) ──
  console.log("\nH · HTTP surface");
  const SITE_URL = envLocal.match(/^CONVEX_SITE_URL=(.+)$/m)?.[1]?.trim();
  let token = "";
  try {
    token = execFileSync("npx", ["convex", "env", "get", "HELM_SURFACE_TOKEN"], {
      cwd: ROOT, encoding: "utf8",
    }).trim();
  } catch { /* unset → section skipped below */ }
  if (!SITE_URL || !token) {
    console.log("  (skipped — CONVEX_SITE_URL or HELM_SURFACE_TOKEN unavailable)");
  } else {
    const noAuth = await fetch(`${SITE_URL}/brief`);
    assert(noAuth.status === 401, "http: /brief without token → 401");
    const queryParam = await fetch(`${SITE_URL}/brief?token=${encodeURIComponent(token)}`);
    assert(queryParam.status === 401, "http: query-param token rejected (header-only)");
    const wrong = await fetch(`${SITE_URL}/brief`, { headers: { "X-Helm-Token": "nope" } });
    assert(wrong.status === 401, "http: wrong token → 401");
    const ok = await fetch(`${SITE_URL}/brief`, { headers: { "X-Helm-Token": token } });
    const okBody = ok.ok ? await ok.json() : null;
    assert(ok.status === 200 && okBody && typeof okBody.date === "string" && okBody.counts,
      "http: header token → 200 with brief payload");
    const preflight = await fetch(`${SITE_URL}/brief`, { method: "OPTIONS" });
    assert(preflight.status === 204, "http: OPTIONS preflight → 204");

    const ingestHeaders = { "Content-Type": "application/json", "X-Helm-Token": token };
    const ingestNoAuth = await fetch(`${SITE_URL}/ingest`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "TEST ingest unauth", dedupeKey: key("h1") }),
    });
    assert(ingestNoAuth.status === 401, "http: /ingest without token → 401");
    const badJson = await fetch(`${SITE_URL}/ingest`, { method: "POST", headers: ingestHeaders, body: "{nope" });
    assert(badJson.status === 400, "http: /ingest bad JSON → 400");
    const noTitle = await fetch(`${SITE_URL}/ingest`, {
      method: "POST", headers: ingestHeaders, body: JSON.stringify({ note: "no title" }),
    });
    assert(noTitle.status === 400, "http: /ingest missing title → 400");
    const ing = await fetch(`${SITE_URL}/ingest`, {
      method: "POST", headers: ingestHeaders,
      body: JSON.stringify({ title: "TEST ingest", dedupeKey: key("h2") }),
    });
    const ingBody = await ing.json();
    const ingDoc = await q("tasks:get", { id: ingBody.taskId });
    assert(ing.status === 200 && ingBody.created === true && ingDoc.needsReview === true
      && ingDoc.source === "ingest", "http: /ingest → proposed task (needsReview, source ingest)");
    const ingAgain = await fetch(`${SITE_URL}/ingest`, {
      method: "POST", headers: ingestHeaders,
      body: JSON.stringify({ title: "TEST ingest again", dedupeKey: key("h2") }),
    });
    assert((await ingAgain.json()).created === false, "http: /ingest idempotent by dedupeKey");
  }

  // ── I · function-level auth (4.1) ──
  console.log("\nI · function-level auth (4.1)");
  if (!API_KEY) {
    console.log("  (skipped — HELM_API_KEY unset on the deployment)");
  } else {
    const envGet = (name) => {
      try {
        return execFileSync("npx", ["convex", "env", "get", name], { cwd: ROOT, encoding: "utf8" }).trim();
      } catch { return ""; }
    };
    const flagWas = envGet("HELM_REQUIRE_KEY");
    execFileSync("npx", ["convex", "env", "set", "HELM_REQUIRE_KEY", "1"], { cwd: ROOT, encoding: "utf8" });
    try {
      let unkeyed = false;
      try { await client.query(makeFunctionReference("queries:brief"), {}); } catch { unkeyed = true; }
      assert(unkeyed, "auth: unkeyed call rejected under enforcement");
      let wrong = false;
      try { await client.query(makeFunctionReference("queries:brief"), { apiKey: "wrong" }); } catch { wrong = true; }
      assert(wrong, "auth: wrong key rejected");
      let wrongWrite = false;
      try {
        await client.mutation(makeFunctionReference("tasks:capture"),
          { apiKey: "wrong", title: "TEST auth", dedupeKey: key("i1") });
      } catch { wrongWrite = true; }
      assert(wrongWrite, "auth: writes gated too");
      const okBrief = await q("queries:brief");
      assert(typeof okBrief.date === "string", "auth: keyed call passes");
      if (SITE_URL && token) {
        const viaToken = await fetch(`${SITE_URL}/brief`, { headers: { "X-Helm-Token": token } });
        assert(viaToken.status === 200, "auth: GET /brief still serves (server-side key hop)");
      }
    } finally {
      // State-preserving: leave enforcement exactly as found (on stays on).
      if (flagWas === "") {
        execFileSync("npx", ["convex", "env", "remove", "HELM_REQUIRE_KEY"], { cwd: ROOT, encoding: "utf8" });
      } else if (flagWas !== "1") {
        execFileSync("npx", ["convex", "env", "set", "HELM_REQUIRE_KEY", flagWas], { cwd: ROOT, encoding: "utf8" });
      }
    }
  }

  // ── J · reactive subscription (the glass contract, 4.1) ──
  console.log("\nJ · reactive subscription (glass contract)");
  if (typeof WebSocket === "undefined") {
    console.log("  (skipped — no WebSocket global in this Node; needs Node 22+)");
  } else {
    const { ConvexClient } = await import("convex/browser");
    const live = new ConvexClient(CONVEX_URL);
    const updates = [];
    const unsub = live.onUpdate(
      makeFunctionReference("queries:list"),
      withKey({ status: "inbox", limit: 200 }),
      (rows) => updates.push(rows),
    );
    await new Promise((r) => setTimeout(r, 2000)); // initial snapshot
    const baseline = updates.length;
    assert(baseline >= 1, "reactive: subscription delivers an initial snapshot");
    const j1 = await m("tasks:capture", { title: "TEST reactive push", dedupeKey: key("j1") });
    const deadline = Date.now() + 6000;
    while (Date.now() < deadline) {
      const latest = updates[updates.length - 1] ?? [];
      if (updates.length > baseline && latest.some((t) => t._id === j1.taskId)) break;
      await new Promise((r) => setTimeout(r, 200));
    }
    const latest = updates[updates.length - 1] ?? [];
    assert(updates.length > baseline && latest.some((t) => t._id === j1.taskId),
      "reactive: the new task arrived by push, no polling");
    unsub();
    await live.close();
  }

  // ── N · glass-shaped reads (4.4) ──
  console.log("\nN · glass-shaped reads (4.4)");
  const n1 = await m("tasks:capture", { title: "TEST parked for later", dedupeKey: key("n1") });
  await m("tasks:snooze", { id: n1.taskId, until: Date.now() + 2 * 3600_000 });
  const priorEnergy = await q("meta:getMeta", { key: "config:energy" });
  try {
    await m("meta:setMeta", { key: "config:energy", value: "deep" });
    const gBrief = await q("queries:brief", {});
    assert(gBrief.upcoming.some((t) => t._id === n1.taskId), "glass brief: parked task in the upcoming strip");
    assert(gBrief.counts.upcoming >= 1 && gBrief.upcoming.length <= 5,
      "glass brief: upcoming capped with a true count");
    assert(gBrief.upcoming.every((t, i, arr) => i === 0 || arr[i - 1].snoozeUntil <= t.snoozeUntil),
      "glass brief: upcoming ordered by soonest wake");
    assert(Array.isArray(gBrief.meetings), "glass brief: meetings section present");
    assert(gBrief.energy === "deep", "glass brief: energy reflects the battery meta");

    const fresh = await q("queries:newToday", {});
    assert(fresh.some((t) => t._id === n1.taskId), "newToday: a just-captured task appears");
    assert(fresh.every((t, i, arr) => i === 0 || arr[i - 1]._creationTime >= t._creationTime),
      "newToday: newest first");
    assert(fresh.every((t) => typeof t.source === "string" && t.area?.key),
      "newToday: provenance + area hydrated");
  } finally {
    if (priorEnergy === null) await m("meta:setMeta", { key: "config:energy", value: "steady" });
    else await m("meta:setMeta", { key: "config:energy", value: priorEnergy });
  }

  // ── M · delegate (4.6, D11) ──
  console.log("\nM · delegate (4.6)");
  const del1 = await m("tasks:capture", {
    title: "TEST chase the credit note", dedupeKey: key("del1"), areaKey: "finance",
  });
  const del2 = await m("tasks:capture", { title: "TEST book the courier", dedupeKey: key("del2") });
  const delDone = await m("tasks:logCompletion", { title: "TEST already finished", dedupeKey: key("del3") });
  const del = await m("tasks:delegate", {
    taskIds: [del1.taskId, del2.taskId, delDone.taskId],
    person: "Sarah",
    dedupeKey: key("del-task"),
  });
  assert(del.delegated === 2, "delegate: open tasks handed over, closed skipped");
  const delDoc1 = await q("tasks:get", { id: del1.taskId });
  const delDoc2 = await q("tasks:get", { id: del2.taskId });
  assert(delDoc1.status === "waiting" && delDoc1.waitingOn === "Sarah" && delDoc1.waitingSince !== undefined
    && delDoc2.status === "waiting" && delDoc2.waitingOn === "Sarah",
    "delegate: originals off the plate — waiting on the person, clock running");
  const delTask = await q("tasks:get", { id: del.delegationTaskId });
  assert(delTask.status === "today" && delTask.size === "xs" && delTask.source === "delegate"
    && delTask.title.includes("Sarah") && delTask.areaId === delDoc1.areaId
    && delTask.kickoffPrompt.length > 20,
    "delegate: one xs today-task minted, in the work's own area, with a handover kickoff");
  await m("tasks:markDone", { id: del.delegationTaskId });
  assert((await q("tasks:get", { id: del1.taskId })).status === "waiting",
    "delegate: completing the handover leaves originals correctly waiting on the person");
  let allClosed = false;
  try { await m("tasks:delegate", { taskIds: [delDone.taskId] }); } catch { allClosed = true; }
  assert(allClosed, "delegate: an all-closed selection is an error, not a silent no-op");
  await m("tasks:setStatus", { id: del.delegationTaskId, status: "dropped" }); // keep today's dayLog clean

  // ── L · meetings mirror (4.2) ──
  console.log("\nL · meetings mirror (4.2)");
  const mNow = Date.now();
  const win = { windowStart: mNow - 2 * 3600_000, windowEnd: mNow + 48 * 3600_000 };
  const seedEvents = (events) => execFileSync(
    "npx", ["convex", "run", "meetings:replaceWindow", JSON.stringify({ ...win, meetings: events })],
    { cwd: ROOT, encoding: "utf8" },
  );
  // Snapshot any real synced rows so the section is delta-safe and restorable.
  // NB: the LIVE 15-min sync cron can replace the window mid-section (observed
  // once) — a seeded-row assertion failing here with real meetings present is
  // that race; the restore in `finally` is then a no-op-equivalent. Rare
  // enough to tolerate: re-run rather than engineering around the cron.
  const realMeetings = (await q("meetings:upcomingMeetings", { horizonHours: 72 }))
    .map(({ eventId, title, startAt, endAt, url }) => ({ eventId, title, startAt, endAt, ...(url ? { url } : {}) }));
  try {
    seedEvents([
      { eventId: "test:reg:evt1", title: "TEST the vendor engineer call", startAt: mNow + 20 * 60_000, endAt: mNow + 50 * 60_000 },
      { eventId: "test:reg:evt2", title: "TEST ops stand-up", startAt: mNow + 3 * 3600_000, endAt: mNow + 4 * 3600_000 },
    ]);
    const up = await q("meetings:upcomingMeetings", {});
    const evt1 = up.find((x) => x.eventId === "test:reg:evt1");
    assert(evt1 && up.find((x) => x.eventId === "test:reg:evt2"), "meetings: seeded window readable");
    assert(up.length >= 2 && up[0].startAt <= up[up.length - 1].startAt, "meetings: ordered by start");

    // Prep link survives a re-sync; promotion fires at T-30, exactly once.
    const prep = await m("tasks:capture", { title: "TEST prep the the vendor call", dedupeKey: key("prep1") });
    await m("meetings:linkPrep", { eventId: "test:reg:evt1", taskId: prep.taskId });
    seedEvents([
      { eventId: "test:reg:evt1", title: "TEST the vendor engineer call (moved)", startAt: mNow + 25 * 60_000, endAt: mNow + 55 * 60_000 },
    ]);
    const relinked = (await q("meetings:upcomingMeetings", {})).find((x) => x.eventId === "test:reg:evt1");
    assert(relinked.prepTaskId === prep.taskId && relinked.title.includes("moved"),
      "meetings: re-sync replaces rows but keeps the prep link");
    const promo1 = JSON.parse(execFileSync("npx", ["convex", "run", "meetings:promotePrep"], { cwd: ROOT, encoding: "utf8" }));
    const prepDoc = await q("tasks:get", { id: prep.taskId });
    assert(promo1.promoted >= 1 && prepDoc.status === "today" && prepDoc.urgent === true,
      "meetings: T-30 promotes the linked prep to today+urgent");
    const promo2 = JSON.parse(execFileSync("npx", ["convex", "run", "meetings:promotePrep"], { cwd: ROOT, encoding: "utf8" }));
    const stillPromoted = (await q("meetings:upcomingMeetings", {})).find((x) => x.eventId === "test:reg:evt1");
    assert(stillPromoted.prepPromotedAt !== undefined && promo2.promoted === 0,
      "meetings: promotion fires once (demotion isn't fought)");

    // OAuth gate open → the sync skips quietly instead of error-spamming the cron.
    const sync = JSON.parse(execFileSync("npx", ["convex", "run", "meetings:syncGoogleCalendar"], { cwd: ROOT, encoding: "utf8" }));
    if (sync.skipped) {
      assert(sync.synced === 0, "meetings: sync skips quietly while the Google OAuth gate is open");
    } else {
      assert(typeof sync.synced === "number", "meetings: live sync ran and reported a count");
    }
  } finally {
    seedEvents(realMeetings); // restore whatever was really in the window
  }

  // ── K · AI action layer (4.3) ──
  console.log("\nK · AI action layer (4.3)");
  const a = (name, args = {}) => client.action(makeFunctionReference(name), withKey(args));
  let anthropicKeySet = false;
  try {
    anthropicKeySet = execFileSync("npx", ["convex", "env", "get", "ANTHROPIC_API_KEY"], {
      cwd: ROOT, encoding: "utf8",
    }).trim().length > 0;
  } catch { /* unset */ }
  if (!anthropicKeySet) {
    let failedClosed = false;
    try {
      await a("ai:enrichCapture", { title: "TEST fail closed" });
    } catch (e) { failedClosed = String(e?.message ?? e).includes("ANTHROPIC_API_KEY"); }
    assert(failedClosed, "ai: fails closed with a pointer when ANTHROPIC_API_KEY unset");
    console.log("  (live LLM assertions skipped — set ANTHROPIC_API_KEY on the deployment to enable)");
  } else {
    const validAreaKeys = new Set((await q("areas:listAreas")).map((x) => x.key));
    const enriched = await a("ai:enrichCapture", {
      title: "Chase Sam at Acme Supplies about the sample credit note",
    });
    assert(validAreaKeys.has(enriched.areaKey), "ai: enrich infers a REAL area key (data, not code)");
    assert(["xs", "m", "l"].includes(enriched.size) && enriched.contextLine.length > 0
      && enriched.kickoffPrompt.length > 10, "ai: enrich fills size/contextLine/kickoffPrompt");

    const polished = await a("ai:polishNote", {
      title: "Chase Sam about the credit note",
      note: "sent Sam the invoice copy, waiting to hear back, chase tmrw if nothing",
    });
    assert(/paused \d{2}:\d{2}/i.test(polished.contextLine) && /next/i.test(polished.contextLine),
      "ai: polish produces the Paused-HH:mm … Next: … re-entry shape");
    assert(polished.contextLine.length <= 220, "ai: polish stays one-line short");

    const parsed = await a("ai:parseSearch", { question: "what am I waiting on?" });
    assert(parsed.filters.status === "waiting", "ai: NL search maps 'waiting on' → status waiting");
    assert(parsed.explanation.length > 0, "ai: NL search explains its reading");
  }

  // ── O · the glass is served (4.7, D10) ──
  console.log("\nO · the glass is served (4.7)");
  if (!SITE_URL) {
    console.log("  (skipped — CONVEX_SITE_URL unavailable)");
  } else {
    const glass = await fetch(`${SITE_URL}/glass`);
    const glassHtml = glass.ok ? await glass.text() : "";
    assert(glass.status === 200 && (glass.headers.get("content-type") ?? "").includes("text/html"),
      "glass: GET /glass serves HTML");
    assert(glassHtml.includes("Helm — the glass") && glassHtml.length > 50_000,
      "glass: the full page is what's served");
    // 4.8 — the WIRED glass, not the sample-data prototype.
    // Pin-agnostic: assert the wired import exists, not a version literal —
    // the pin's single source of truth is the page itself (D16).
    assert(/esm\.sh\/convex@[\d.]+\/browser/.test(glassHtml),
      "glass: wired — ConvexClient via a pinned esm.sh import (D16)");
    assert(glassHtml.includes("queries:brief") && glassHtml.includes("helm:apiKey"),
      "glass: wired — brief subscription + key gate present");
    assert(!glassHtml.includes("Chase Acme Supplies about the sample credit note"),
      "glass: sample data is gone");
  }

  // ── P · merge + connect (5.1 / 5.2, docs/03-data-model.md) ──
  console.log("\nP · merge + connect (5.1/5.2)");

  // Connect: symmetric, idempotent, self-link rejected.
  const p1 = await m("tasks:capture", { title: "TEST cluster reply to the customer", dedupeKey: key("p1") });
  const p2 = await m("tasks:capture", { title: "TEST cluster artwork placement", dedupeKey: key("p2") });
  await m("tasks:connect", { aId: p1.taskId, bId: p2.taskId });
  let p1doc = await q("tasks:get", { id: p1.taskId });
  let p2doc = await q("tasks:get", { id: p2.taskId });
  assert(p1doc.links?.includes(p2.taskId) && p2doc.links?.includes(p1.taskId),
    "connect: both sides linked (symmetric adjacency)");
  await m("tasks:connect", { aId: p2.taskId, bId: p1.taskId });
  p1doc = await q("tasks:get", { id: p1.taskId });
  assert((p1doc.links ?? []).filter((l) => l === p2.taskId).length === 1,
    "connect: idempotent — re-connect (either direction) adds nothing");
  await throws(() => m("tasks:connect", { aId: p1.taskId, bId: p1.taskId }),
    "connect: self-link rejected");
  await m("tasks:disconnect", { aId: p1.taskId, bId: p2.taskId });
  p1doc = await q("tasks:get", { id: p1.taskId });
  p2doc = await q("tasks:get", { id: p2.taskId });
  assert(p1doc.links === undefined && p2doc.links === undefined,
    "disconnect: last edge removes the field on both sides (no empty husk)");
  await m("tasks:disconnect", { aId: p1.taskId, bId: p2.taskId }); // no throw = idempotent
  assert(true, "disconnect: idempotent on a missing edge");

  // Merge: newer source folds into older target; context unioned; provenance kept.
  const pt = await m("tasks:capture", {
    title: "TEST service retry alert", dedupeKey: key("pt"),
    note: "3 overnight retries", areaKey: "work",
  });
  await new Promise((r) => setTimeout(r, 5));
  const ps = await m("tasks:capture", {
    title: "TEST repeated service retries", dedupeKey: key("ps"),
    note: "monitoring alert #2", contextLine: "same incident, second alert email",
    kickoffPrompt: "Investigate the service retries", needsReview: true,
  });
  // Pre-link the source to a neighbour so the merge must migrate the edge.
  await m("tasks:connect", { aId: ps.taskId, bId: p1.taskId });
  const pm = await m("tasks:merge", { sourceId: ps.taskId, targetId: pt.taskId });
  assert(pm.targetId === pt.taskId, "merge: returns the surviving target");
  const ptDoc = await q("tasks:get", { id: pt.taskId });
  const psDoc = await q("tasks:get", { id: ps.taskId });
  assert(psDoc.status === "dropped" && psDoc.mergedInto === pt.taskId,
    "merge: source dropped with a mergedInto pointer (traceable, not lost)");
  assert(ptDoc.status === "inbox", "merge: target's own state untouched");
  assert(ptDoc.note.includes("3 overnight retries") && ptDoc.note.includes("monitoring alert #2"),
    "merge: differing notes both survive (concatenated)");
  assert(ptDoc.contextLine === "same incident, second alert email"
    && ptDoc.kickoffPrompt === "Investigate the service retries",
    "merge: source fills the context gaps the target lacked");
  assert(ptDoc.mergedFrom?.length === 1 && ptDoc.mergedFrom[0].title.includes("repeated service")
    && ptDoc.mergedFrom[0].dedupeKey === key("ps"),
    "merge: provenance stashed on mergedFrom[]");
  assert(ptDoc.dedupeAliases?.includes(key("ps")),
    "merge: source's dedupeKey aliased onto the target");
  assert(ptDoc.links?.includes(p1.taskId) && !ptDoc.links.includes(ps.taskId)
    && psDoc.links === undefined,
    "merge: links migrated to the target, none left on the source");
  const p1after = await q("tasks:get", { id: p1.taskId });
  assert(p1after.links?.includes(pt.taskId) && !p1after.links.includes(ps.taskId),
    "merge: neighbour re-pointed at the target (adjacency stays symmetric)");

  // Re-sweep safety: a capture on the MERGED-AWAY key refreshes the target.
  const reSweep = await m("tasks:capture", {
    title: "TEST re-swept dupe thread", dedupeKey: key("ps"), contextLine: "third alert email",
  });
  assert(reSweep.created === false && reSweep.taskId === pt.taskId,
    "merge: re-sweep of the source's thread lands on the TARGET (no dupe minted)");
  assert((await q("tasks:get", { id: pt.taskId })).contextLine === "third alert email",
    "merge: re-sweep refreshed the target's re-entry context");

  // "Did it" on the merged-away key completes the target.
  const didIt = await m("tasks:logCompletion", { title: "irrelevant", dedupeKey: key("ps") });
  const ptDone = await q("tasks:get", { id: pt.taskId });
  assert(didIt.taskId === pt.taskId && ptDone.status === "done" && ptDone.doneAt !== undefined,
    "merge: logCompletion on the source's key completes the target");

  // Done target + re-sweep on the alias key → fresh task (done fall-through
  // survives the redirect; the thread can become live again).
  const reAfterDone = await m("tasks:capture", { title: "TEST thread reactivates", dedupeKey: key("ps") });
  assert(reAfterDone.created === true && reAfterDone.taskId !== pt.taskId,
    "merge: done target + re-swept source key mints a fresh task (done fall-through intact)");

  // Guards: closed participants and self-merge are errors.
  await throws(() => m("tasks:merge", { sourceId: ps.taskId, targetId: reAfterDone.taskId }),
    "merge: closed source rejected");
  await throws(() => m("tasks:merge", { sourceId: reAfterDone.taskId, targetId: pt.taskId }),
    "merge: closed target rejected");
  await throws(() => m("tasks:merge", { sourceId: p1.taskId, targetId: p1.taskId }),
    "merge: self-merge rejected");

  // A confirmed source merging into a proposal confirms it.
  const prA = await m("tasks:capture", { title: "TEST proposal dupe", dedupeKey: key("prA"), needsReview: true });
  await new Promise((r) => setTimeout(r, 5));
  const prB = await m("tasks:capture", { title: "TEST confirmed dupe", dedupeKey: key("prB") });
  await m("tasks:merge", { sourceId: prB.taskId, targetId: prA.taskId });
  assert((await q("tasks:get", { id: prA.taskId })).needsReview === false,
    "merge: confirmed source clears the target's needsReview (the merge IS the confirm)");

  // ── Q · done + follow-up (5.5) ──
  console.log("\nQ · done + follow-up (5.5)");
  // The glass flow, server-side: markDone the original → capture the follow-up
  // with the semantic dedupe key → connect → snooze if the draft carried timing.
  const q1 = await m("tasks:capture", {
    title: "TEST follow up with sales lead", dedupeKey: key("q1"),
    areaKey: "work", contextLine: "sent the quote Tuesday, no reply yet",
  });
  await m("tasks:markDone", { id: q1.taskId });
  const fupKey = key("fup:") + q1.taskId + ":call-the-sales-lead-by-phone";
  const q2 = await m("tasks:capture", {
    title: "TEST call the sales lead by phone", dedupeKey: fupKey,
    areaKey: "work", status: "next", source: "followup",
    contextLine: "Quote sent + chased; call if still quiet.",
  });
  assert(q2.created === true, "follow-up: fresh semantic key mints the task");
  await m("tasks:connect", { aId: q2.taskId, bId: q1.taskId });
  await m("tasks:snooze", { id: q2.taskId, until: Date.now() + 72 * 3600_000 });
  const q2doc = await q("tasks:get", { id: q2.taskId });
  const q1doc = await q("tasks:get", { id: q1.taskId });
  assert(q1doc.status === "done" && q2doc.status === "next" && q2doc.source === "followup",
    "follow-up: original done, follow-up queued on next with source followup");
  assert(q2doc.links?.includes(q1.taskId) && q1doc.links?.includes(q2.taskId),
    "follow-up: connected to its origin (provenance cluster, incl. a done sibling)");
  assert(q2doc.snoozeUntil > Date.now() + 71 * 3600_000,
    "follow-up: timing parks it for the waker to bring back");
  // The de-dup check: a re-fired identical instruction refreshes, never doubles…
  const q2re = await m("tasks:capture", {
    title: "irrelevant", dedupeKey: fupKey, contextLine: "re-fire",
  });
  assert(q2re.created === false && q2re.taskId === q2.taskId,
    "follow-up: identical re-fire dedupes (no double mint)");
  // …while a DIFFERENT follow-up from the same original still mints its own row.
  const q3 = await m("tasks:capture", {
    title: "TEST send the sales lead a case study",
    dedupeKey: key("fup:") + q1.taskId + ":send-a-case-study", status: "next", source: "followup",
  });
  assert(q3.created === true && q3.taskId !== q2.taskId,
    "follow-up: a different instruction from the same origin mints separately");

  // ai:draftFollowUp — live when the key is set; fail-closed pointer otherwise.
  if (!anthropicKeySet) {
    let closed = false;
    try { await a("ai:draftFollowUp", { originalTitle: "x", instruction: "y" }); }
    catch (e) { closed = String(e?.message ?? e).includes("ANTHROPIC_API_KEY"); }
    assert(closed, "ai: draftFollowUp fails closed with a set-the-key pointer");
  } else {
    const draft = await a("ai:draftFollowUp", {
      originalTitle: "Follow up with sales lead",
      originalContext: "sent the quote Tuesday, no reply yet",
      instruction: "Call the sales lead by phone if they haven't responded in 3 days",
    });
    assert(draft.title.length > 0 && ["xs", "m", "l"].includes(draft.size)
      && draft.contextLine.length > 0 && draft.kickoffPrompt.length > 10,
      "ai: draftFollowUp fills title/size/contextLine/kickoffPrompt");
    assert(typeof draft.wakeInHours === "number" && draft.wakeInHours >= 24,
      "ai: draftFollowUp reads 'in 3 days' as a real wake delay (hours)");
  }

  // Settings updates are transactional and restore the user's configuration.
  console.log("\nR · settings document");
  const settingsBefore = await q("settings:get");
  assert(typeof settingsBefore.timezone === "string" && Array.isArray(settingsBefore.sources),
    "settings: a complete document is returned");
  try {
    const configured = await m("settings:update", { patch: {
      owner: { shortName: "Sam" }, timezone: "America/New_York",
      workday: { start: "07:00", end: "17:00", days: [1, 3, 5], eveningWatchFrom: "18:00" },
      caps: { today: 2, waiting: 3, newToday: 2, focusMinutes: 30 },
      sources: [{ key: "gcal", label: "Calendar", kind: "calendar", enabled: true, mcpServer: "calendar" }],
      hook: { logSessions: false, includeCwd: false, titleChars: 100 },
    }});
    assert(configured.owner.shortName === "Sam" && configured.owner.name === settingsBefore.owner.name,
      "settings: partial owner update preserves omitted fields");
    const reread = await q("settings:get");
    assert(reread.timezone === "America/New_York" && reread.workday.start === "07:00"
      && reread.caps.today === 2 && reread.sources[0].key === "gcal" && reread.hook.titleChars === 100,
      "settings: time, caps, sources and hook round-trip");
    const customBrief = await q("queries:brief");
    assert(customBrief.date === new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(Date.now()),
      "settings consumers: brief date follows the configured timezone");
    assert(customBrief.today.length <= 2 && customBrief.waiting.length <= 3
      && (await q("queries:newToday")).length <= 2,
      "settings consumers: display caps follow overrides");
    for (const patch of [
      { timezone: "Invalid/Timezone" }, { founderContext: "x".repeat(801) },
      { workday: { start: "25:00" } }, { workday: { days: [1, 1] } },
      { workday: { end: "06:00" } }, { caps: { today: -1 } },
      { hook: { titleChars: 0 } }, { sources: [reread.sources[0], reread.sources[0]] },
    ]) await throws(() => m("settings:update", { patch }), "settings: invalid " + Object.keys(patch)[0] + " rejected");
    await throws(() => m("meta:setMeta", { key: "settings", value: {} }),
      "settings: generic meta write cannot bypass validation");
    assert((await q("settings:get")).timezone === "America/New_York", "settings: rejected updates preserve data");
    await m("settings:update", { patch: { caps: { focusMinutes: 40, today: 4 } } });
    const singleReset = await m("settings:update", { patch: { caps: { focusMinutes: null } } });
    assert(singleReset.caps.focusMinutes === undefined && singleReset.caps.today === 4,
      "settings: one cap resets without deleting other overrides");
    const cleared = await m("settings:update", { patch: { caps: null, workday: { eveningWatchFrom: null } } });
    assert(cleared.caps === undefined && cleared.workday.eveningWatchFrom === undefined,
      "settings: optional overrides can be removed");
  } finally {
    await m("settings:update", { patch: {
      ...settingsBefore, caps: settingsBefore.caps ?? null,
      workday: { ...settingsBefore.workday, eveningWatchFrom: settingsBefore.workday.eveningWatchFrom ?? null },
    }});
  }

  console.log("\nS · timezone calendar boundaries");
  const calendarCases = [
    { date: "2026-03-29", timezone: "Europe/London" },
    { date: "2026-10-25", timezone: "Europe/London" },
    { date: "2026-03-08", timezone: "America/New_York" },
    { date: "2026-11-01", timezone: "America/New_York" },
    { date: "2026-01-15", timezone: "Asia/Kathmandu" },
    { date: "2011-12-30", timezone: "Pacific/Apia" },
  ];
  const ranges = JSON.parse(execFileSync("npx", ["convex", "run", "testing:calendarRanges", JSON.stringify({ cases: calendarCases })],
    { cwd: ROOT, encoding: "utf8" }));
  for (const [i, hours] of [23, 25, 23, 25, 24, 0].entries()) {
    assert(ranges[i].end - ranges[i].start === hours * 3600_000,
      `time: ${calendarCases[i].timezone} ${calendarCases[i].date} spans ${hours} hours`);
  }
  assert(ranges[4].start === Date.UTC(2026, 0, 14, 18, 15), "time: fractional offset opens on the correct UTC date");

  // ── T · area seed: empty-store probe rolls back the whole transaction ──
  console.log("\nT · area seed");
  const originalAreas = await q("areas:listAreas", { includeArchived: true });
  const dev = development();
  for (const [preset, areas] of Object.entries(AREA_PRESETS)) {
    validateAreas(areas);
    let passedProbe = false;
    try {
      execFileSync("npx", ["--no-install", "convex", "run", "testing:seedEmptyProbe", JSON.stringify({ areas }), "--env-file", dev.envFile],
        { cwd: ROOT, env: dev.env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    } catch (e) { passedProbe = String(e.stderr ?? "").includes("SEED_PROBE_PASSED_ROLLED_BACK"); }
    assert(passedProbe, `seed: ${preset} empty-store insert and idempotent repeat observed`);
  }
  assert(JSON.stringify(await q("areas:listAreas", { includeArchived: true })) === JSON.stringify(originalAreas),
    "seed: rollback preserves existing area IDs and values");
  const noSeed = await m("areas:seedAreas", { areas: AREA_PRESETS.generic, onlyIfEmpty: true });
  assert(noSeed.inserted === 0 && noSeed.updated === 0, "seed: existing area set is untouched");
  await throws(() => m("areas:seedAreas", { areas: [AREA_PRESETS.generic[0], AREA_PRESETS.generic[0]] }), "seed: duplicate keys rejected");
  await throws(() => m("areas:seedAreas", { areas: [{ ...AREA_PRESETS.generic[0], color: "red" }] }), "seed: invalid colors rejected");

  const editableArea = originalAreas[0];
  await throws(() => m("areas:upsertArea", { key: editableArea.key, label: editableArea.label, color: "url(test)" }),
    "areas: editor rejects invalid color");
  await throws(() => m("areas:upsertArea", { key: editableArea.key, label: "", color: editableArea.color }),
    "areas: editor rejects empty label");
  await throws(() => m("areas:upsertArea", { key: editableArea.key, label: "Duplicate", color: editableArea.color, createOnly: true }),
    "areas: create-only rejects an existing key atomically");
  const retiredArea = originalAreas.find(a => !a.archived);
  const oldDefault = await q("meta:getMeta", { key: "config:captureDefaultAreaKey" });
  try {
    await m("meta:setMeta", { key: "config:captureDefaultAreaKey", value: retiredArea.key });
    await m("areas:upsertArea", { key: retiredArea.key, label: retiredArea.label, color: retiredArea.color, archived: true });
    const fallback = await m("tasks:capture", { title: "TEST retired default area", dedupeKey: key("retired-area") });
    assert((await q("tasks:get", { id: fallback.taskId })).areaId !== retiredArea._id, "areas: retired default falls back to an active area");
  } finally {
    await m("areas:upsertArea", { key: retiredArea.key, label: retiredArea.label, color: retiredArea.color, archived: false });
    await m("meta:setMeta", { key: "config:captureDefaultAreaKey", value: oldDefault });
  }

  // ── G · janitor proves itself ──
  console.log("\nG · purge");
  const purged = purge();
  assert(purged.tasks > 0 && purged.checkins > 0, "purge: removed the fixture footprint");
  const rePurged = purge();
  assert(rePurged.tasks === 0 && rePurged.checkins === 0, "purge: second pass finds nothing (clean)");
  const gone = await q("tasks:get", { id: a1.taskId });
  assert(gone === null, "purge: fixtures really deleted");
}

// ── run ──────────────────────────────────────────────────────────────────────

let failedHard = null;
try {
  await main();
} catch (err) {
  failedHard = err;
} finally {
  try {
    purge(); // always leave dev clean, even after a mid-suite crash
  } catch (err) {
    console.error("regression: final purge failed —", err?.message ?? err);
  }
}

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failedHard) {
  console.error("suite crashed:", failedHard);
  process.exit(1);
}
if (failures.length) {
  for (const f of failures) console.error(`  FAILED: ${f}`);
  process.exit(1);
}
console.log("all green");
