#!/usr/bin/env node
/**
 * Helm MCP server (stdio).
 *
 * Exposes the Helm brain — the Convex mutations/queries from docs/04 — as MCP
 * tools so Claude Code (and later Claude Tag) can capture, brief, execute and
 * auto-log against it. Dumb glass surfaces use the token HTTP endpoint instead;
 * AI actors get tools (docs/02).
 *
 * Config: set HELM_CONVEX_URL to the deployment's client URL (CONVEX_URL from
 * the Helm repo's .env.local, e.g. https://<name>.convex.cloud). The server
 * holds no secrets in code.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { z } from "zod";

const CONVEX_URL = process.env.HELM_CONVEX_URL;
if (!CONVEX_URL) {
  console.error(
    "helm-mcp: HELM_CONVEX_URL is not set. Point it at the Helm Convex deployment " +
      "client URL (CONVEX_URL in the helm repo .env.local).",
  );
  process.exit(1);
}

// Function-level auth (4.1, D15): every public Helm function requires the
// shared API key. Missing key = every call is rejected by default.
// Warn loudly but stay up, so the
// error surfaces per-call rather than as a silent dead server.
const API_KEY = process.env.HELM_API_KEY;
if (!API_KEY) {
  console.error(
    "helm-mcp: HELM_API_KEY is not set — calls are rejected by default. " +
      "Re-register the MCP server with HELM_API_KEY in its environment.",
  );
}

const convex = new ConvexHttpClient(CONVEX_URL, { logger: false });
const server = new McpServer({ name: "helm", version: "0.1.0" });

// ── shared enums (mirror convex/validators.ts) ───────────────────────────────
const status = z.enum(["inbox", "today", "next", "waiting", "someday", "done", "dropped"]);
const captureStatus = z.enum(["inbox", "today", "next", "waiting", "someday"]);
const size = z.enum(["xs", "m", "l"]);
const origin = z.enum(["planned", "adhoc"]);
const sourceRef = z
  .object({ url: z.string().optional(), threadId: z.string().optional(), label: z.string().optional() })
  .optional();

/** Register a tool that forwards straight to a Convex function by name. */
function forward(name, description, shape, kind, fnName) {
  server.tool(name, description, shape, async (args) => {
    try {
      const ref = makeFunctionReference(fnName);
      const withKey = { ...(args ?? {}), ...(API_KEY ? { apiKey: API_KEY } : {}) };
      const result =
        kind === "query" ? await convex.query(ref, withKey) : await convex.mutation(ref, withKey);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      const message = String(err?.message ?? err);
      const safeMessage = API_KEY ? message.replaceAll(API_KEY, "[redacted]") : message;
      return {
        isError: true,
        content: [{ type: "text", text: `helm ${name} failed: ${safeMessage}` }],
      };
    }
  });
}

// Settings patches mirror convex/validators.ts. The backend validates bounds.
const source = z.object({
  key: z.string(), label: z.string(),
  kind: z.enum(["email", "chat", "calendar", "meetings", "tracker", "custom"]),
  mcpServer: z.string().optional(), enabled: z.boolean(), notes: z.string().optional(),
}).strict();
const settingsPatch = z.object({
  owner: z.object({ name: z.string().optional(), shortName: z.string().optional(),
    role: z.string().optional(), business: z.string().optional(), tone: z.string().optional() }).strict().optional(),
  founderContext: z.string().optional(), timezone: z.string().optional(),
  workday: z.object({ start: z.string().optional(), end: z.string().optional(),
    days: z.array(z.number()).optional(), eveningWatchFrom: z.string().nullable().optional() }).strict().optional(),
  caps: z.object(Object.fromEntries(["today", "wins", "ageing", "waiting", "upcoming", "newToday",
    "waitingAgeingDays", "openAgeingDays", "meetingPrepLeadMin", "focusMinutes"]
    .map(key => [key, z.number().nullable().optional()]))).strict().nullable().optional(),
  sources: z.array(source).optional(),
  hook: z.object({ logSessions: z.boolean().optional(), includeCwd: z.boolean().optional(),
    titleChars: z.number().optional() }).strict().optional(),
}).strict();
forward("getSettings", "Read the owner's settings, timezone, tone, workday, caps, sources, and hook preferences. Call this first in each Helm skill.",
  {}, "query", "settings:get");
forward("updateSettings", "Change the requested settings. Omitted fields stay unchanged. sources replaces the whole list. caps:null clears all cap overrides; a null cap field clears just that override; workday.eveningWatchFrom:null clears that override. Never put secrets in settings.",
  { patch: settingsPatch }, "mutation", "settings:update");

// ── writes ───────────────────────────────────────────────────────────────────
forward(
  "capture",
  "Capture a forward task into Helm (origin: planned). Pass a one-line title; " +
    "use an area key from listAreas when you can. " +
    "Add a contextLine ('where this is at') and a kickoffPrompt (a ready-to-run instruction) to kill re-entry cost. " +
    "Default status is inbox; set today/next if clearly stated. dedupeKey preserves open/dropped work. Set reopenCompleted:false with a dedupeKey for rolling calendar reads; completed prep then stays completed.",
  {
    title: z.string(),
    note: z.string().optional(),
    areaKey: z.string().optional(),
    status: captureStatus.optional(),
    size: size.optional(),
    urgent: z.boolean().optional(),
    source: z.string().optional(),
    sourceRef,
    contextLine: z.string().optional(),
    kickoffPrompt: z.string().optional(),
    vaultRef: z.string().optional(),
    waitingOn: z.string().optional(),
    dueAt: z.number().optional(),
    needsReview: z.boolean().optional(),
    dedupeKey: z.string().optional(),
    reopenCompleted: z.boolean().optional(),
  },
  "mutation",
  "tasks:capture",
);

forward(
  "logCompletion",
  "Log work that ALREADY happened (origin: adhoc, status: done). The distraction/rabbit-hole catcher — " +
    "use it when you've just done something unplanned so the day reconciles itself. provisional:true marks a " +
    "hook-logged completion the evening pass can refine.",
  {
    title: z.string(),
    note: z.string().optional(),
    areaKey: z.string().optional(),
    size: size.optional(),
    source: z.string().optional(),
    sourceRef,
    contextLine: z.string().optional(),
    vaultRef: z.string().optional(),
    provisional: z.boolean().optional(),
    doneAt: z.number().optional(),
    dedupeKey: z.string().optional(),
  },
  "mutation",
  "tasks:logCompletion",
);

forward("markDone", "Mark a task done (stamps doneAt).", { id: z.string() }, "mutation", "tasks:markDone");
forward(
  "snooze",
  "Hide a task until a wake time (epoch ms). No-guilt deferral — it reappears later.",
  { id: z.string(), until: z.number() },
  "mutation",
  "tasks:snooze",
);
forward(
  "wake",
  "Un-snooze a task: clear its wake time so it returns to its surfaces immediately.",
  { id: z.string() },
  "mutation",
  "tasks:wake",
);
forward(
  "defer",
  "Push a task to another status (next/someday/waiting/…). No-guilt deferral.",
  { id: z.string(), status },
  "mutation",
  "tasks:defer",
);
forward("setStatus", "Set a task's status.", { id: z.string(), status }, "mutation", "tasks:setStatus");
forward(
  "update",
  "Patch editable fields on a task (title, note, areaKey, size, urgent, contextLine, kickoffPrompt, dueAt, waitingOn, snoozeUntil).",
  {
    id: z.string(),
    title: z.string().optional(),
    note: z.string().optional(),
    areaKey: z.string().optional(),
    size: size.optional(),
    urgent: z.boolean().optional(),
    contextLine: z.string().optional(),
    kickoffPrompt: z.string().optional(),
    vaultRef: z.string().optional(),
    waitingOn: z.string().optional(),
    dueAt: z.number().optional(),
    snoozeUntil: z.number().optional(),
  },
  "mutation",
  "tasks:update",
);
forward(
  "delegate",
  "Get tasks off the user's plate in one gesture (use when they say 'delegate X to Y', 'hand this to', " +
    "'get someone else to'). Moves the selected open tasks to waiting on <person> AND mints one xs " +
    "today-task to do the delegating (kickoffPrompt drafts the handover). Follow-up comes free from " +
    "the waiting/ageing machinery.",
  {
    taskIds: z.array(z.string()).max(100),
    person: z.string().optional(),
    note: z.string().optional(),
  },
  "mutation",
  "tasks:delegate",
);
forward(
  "confirmProposed",
  "One-tap confirm a sweep-proposed task (clears needsReview).",
  { id: z.string() },
  "mutation",
  "tasks:confirmProposed",
);
forward(
  "merge",
  "Merge a TRUE duplicate into its survivor (use when two tasks are the same underlying thing " +
    "captured twice, e.g. from two emails on one incident). Default target = the OLDER task so the " +
    "original added-date is kept. Context is unioned, provenance kept on the target (mergedFrom), " +
    "and the duplicate's thread stays dedupe-safe on re-sweeps. The source is dropped with a " +
    "mergedInto pointer. For related-but-DIFFERENT tasks use connect instead.",
  { sourceId: z.string(), targetId: z.string() },
  "mutation",
  "tasks:merge",
);
forward(
  "connect",
  "Link two RELATED but distinct tasks into a navigable cluster (same person/project, different " +
    "actions — both stay live). Symmetric and idempotent. For true duplicates use merge instead.",
  { aId: z.string(), bId: z.string() },
  "mutation",
  "tasks:connect",
);
forward(
  "disconnect",
  "Remove a connect-link between two tasks (both sides). Idempotent.",
  { aId: z.string(), bId: z.string() },
  "mutation",
  "tasks:disconnect",
);

// ── reads ──────────────────────────────────────────────────────────────────—
forward(
  "brief",
  "The morning payload: today's pick + today's configured selection, waiting-on-others (oldest first), 2-min wins, ageing flags, streak. Lead with this.",
  {},
  "query",
  "queries:brief",
);
forward("todaysPick", "The single right-now task, or null.", {}, "query", "queries:todaysPick");
forward(
  "dayLog",
  "Everything completed on a day in the configured timezone (planned + adhoc) — the evening reconcile payload. Defaults to today.",
  { date: z.string().optional() },
  "query",
  "queries:dayLog",
);
forward("inbox", "Sweep-proposed tasks awaiting one-tap confirm (needsReview).", {}, "query", "queries:inbox");
forward("waiting", "Tasks blocked on others, oldest first.", {}, "query", "queries:waiting");
forward(
  "list",
  "Generic indexed read for natural-language queries. Filter by status, areaKey, origin, or needsReview. Lead with overdue/waiting; group by area.",
  {
    status: status.optional(),
    areaKey: z.string().optional(),
    origin: origin.optional(),
    needsReview: z.boolean().optional(),
    includeSnoozed: z.boolean().optional(),
    limit: z.number().optional(),
  },
  "query",
  "queries:list",
);
forward("listPage", "Read indexed task history in creation order, newest first. Without a status, include closed work too. Pass continueCursor as cursor until isDone, even if a filtered page is empty. A page scans at most numItems rows (1–200) within read limits. Use this when list reports a capacity error; keep the same filters across pages.",
  { status: status.optional(), areaKey: z.string().optional(), origin: origin.optional(),
    needsReview: z.boolean().optional(), includeSnoozed: z.boolean().optional(),
    cursor: z.string().nullable().optional(), numItems: z.number().int().min(1).max(200).optional() },
  "query", "queries:listPage");
forward("get", "Fetch a single task by id.", { id: z.string() }, "query", "tasks:get");
forward(
  "listAreas",
  "List the brain's areas (categories). Use to resolve/confirm an areaKey.",
  { includeArchived: z.boolean().optional() },
  "query",
  "areas:listAreas",
);

// ── sweep watermarks (Phase 2) ───────────────────────────────────────────────
forward(
  "getWatermark",
  "Get the intraday-sweep watermark (epoch ms, 0 if never) for a source — pull only items newer than this.",
  { source: z.string() },
  "query",
  "meta:getWatermark",
);
forward(
  "advanceWatermark",
  "Advance a sweep source's watermark to the newest item processed (monotonic — only moves forward).",
  { source: z.string(), at: z.number() },
  "mutation",
  "meta:advanceWatermark",
);

// ── check-ins / reconcile (Phase 1) ──────────────────────────────────────────
forward(
  "chooseToday",
  "Commit today's configured selection: record the chosen task ids and move them to status 'today' so every surface leads with them.",
  { taskIds: z.array(z.string()).max(200), date: z.string().optional() },
  "mutation",
  "checkins:chooseToday",
);
forward(
  "reconcileDay",
  "Run the evening reconcile: write today's evening check-in and return counts (completed planned/adhoc, carried).",
  { date: z.string().optional(), summary: z.string().optional() },
  "mutation",
  "checkins:reconcileDay",
);
forward(
  "reconcileOutstanding",
  "Self-healing reconcile: close today AND catch up any missed days (bounded window, default 14) — " +
    "backfills evening check-ins for days that had completions but were never closed, and confirms " +
    "surviving provisional completions so they count toward the streak. Prefer this over reconcileDay " +
    "for the evening routine. Returns {reconciled:[dates backfilled], healed:n}.",
  {
    lookbackDays: z.number().int().min(1).max(60).optional(),
    dates: z.array(z.string()).max(60).optional(),
    summary: z.string().optional(),
  },
  "mutation",
  "checkins:reconcileOutstanding",
);
forward(
  "getCheckin",
  "Read a check-in row for a date + kind (morning/evening).",
  { date: z.string(), kind: z.enum(["morning", "evening"]) },
  "query",
  "checkins:getCheckin",
);

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("helm-mcp: connected, serving Helm tools over stdio →", CONVEX_URL);
