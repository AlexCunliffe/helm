"use node";
/**
 * The AI action layer (slice 4.3, D12) — Helm's first server-side AI. Three
 * small, on-demand Claude calls the glass (and any client) can reach without
 * having an LLM of its own:
 *
 *   enrichCapture  — bare title → area/size/contextLine/kickoffPrompt
 *   polishNote     — raw progress note → the re-entry contextLine (docs/06-surfaces.md:
 *                    "written at maximum context, read at minimum context")
 *   parseSearch    — natural-language question → `list` filters + explanation
 *
 * Cost rules (docs/07): claude-haiku-4-5 ($1/$5 per MTok), hard max_tokens
 * caps, on-demand only — no schedule, no watermark. Structured outputs
 * (output_config.format) guarantee schema-valid JSON, so there is no fragile
 * text parsing. Fail closed when ANTHROPIC_API_KEY is unset.
 *
 * Areas are fetched per call from the areas table — never hardcoded (docs/09:
 * categories are data, not code).
 */
import Anthropic from "@anthropic-ai/sdk";
import { action } from "./_generated/server";
import { api } from "./_generated/api";
import { v } from "convex/values";
import { requireKey } from "./lib/auth";
import { sizeValidator, statusValidator, originValidator } from "./validators";

const MODEL = "claude-haiku-4-5";
const apiKeyArg = { apiKey: v.optional(v.string()) };

function client(): Anthropic {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    throw new Error(
      "ai: ANTHROPIC_API_KEY is not configured on the deployment — " +
        "set it with `npx convex env set ANTHROPIC_API_KEY sk-ant-…`",
    );
  }
  return new Anthropic({ apiKey: key });
}

/** One structured call: system + user → schema-valid JSON, hard token cap. */
async function structured<T>(
  system: string,
  user: string,
  schema: Record<string, unknown>,
  maxTokens: number,
): Promise<T> {
  const response = await client().messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    system,
    output_config: { format: { type: "json_schema", schema } },
    messages: [{ role: "user", content: user }],
  });
  if (response.stop_reason === "refusal") {
    throw new Error("ai: the model declined this request");
  }
  if (response.stop_reason === "max_tokens") {
    throw new Error("ai: output hit the token cap — input too large for this call");
  }
  const text = response.content.find((b) => b.type === "text");
  if (!text || text.type !== "text") throw new Error("ai: empty model response");
  return JSON.parse(text.text) as T;
}

const HELM_CONTEXT =
  "Helm is a personal task system. Use plain language for one-line tasks. " +
  "Sizes: xs = a ~2-minute win, m = a normal focus block, l = deep work.";

// ── enrichCapture ────────────────────────────────────────────────────────────

export const enrichCapture = action({
  args: { ...apiKeyArg, title: v.string(), note: v.optional(v.string()) },
  returns: v.object({
    areaKey: v.string(),
    size: sizeValidator,
    contextLine: v.string(),
    kickoffPrompt: v.string(),
  }),
  handler: async (ctx, { apiKey, title, note }) => {
    requireKey(apiKey);
    const areas: Array<{ key: string; label: string }> = await ctx.runQuery(
      api.areas.listAreas,
      { apiKey },
    );
    const keys = areas.map((a) => a.key);

    return await structured<{
      areaKey: string;
      size: "xs" | "m" | "l";
      contextLine: string;
      kickoffPrompt: string;
    }>(
      `${HELM_CONTEXT}\nYou enrich a freshly captured task so it files itself. ` +
        `Areas (key: label): ${areas.map((a) => `${a.key}: ${a.label}`).join(", ")}. ` +
        `contextLine = one line (≤140 chars) of "where this is at" — the fact that kills ` +
        `re-entry cost. kickoffPrompt = a ready-to-run instruction Claude Code could execute ` +
        `to start this task for the user (imperative, self-contained, 1–3 sentences).`,
      note ? `Task: ${title}\nNote: ${note}` : `Task: ${title}`,
      {
        type: "object",
        properties: {
          areaKey: { type: "string", enum: keys },
          size: { type: "string", enum: ["xs", "m", "l"] },
          contextLine: { type: "string" },
          kickoffPrompt: { type: "string" },
        },
        required: ["areaKey", "size", "contextLine", "kickoffPrompt"],
        additionalProperties: false,
      },
      700,
    );
  },
});

// ── polishNote ───────────────────────────────────────────────────────────────

export const polishNote = action({
  args: {
    ...apiKeyArg,
    title: v.string(),
    note: v.string(),
    previousContextLine: v.optional(v.string()),
  },
  returns: v.object({ contextLine: v.string() }),
  handler: async (_ctx, { apiKey, title, note, previousContextLine }) => {
    requireKey(apiKey);
    const londonTime = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/London",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date());

    // The "Paused HH:MM — … Next: …" shape is a contract (docs/06-surfaces.md), so the
    // model returns the PARTS and the line is composed here — the shape can't
    // be dropped, doubled, or half-followed the way free-prose output can.
    const parts = await structured<{ happened: string; next: string }>(
      `${HELM_CONTEXT}\nThe user is pausing a task and jotted a raw progress note. It becomes the ` +
        `task's re-entry contextLine: "Paused ${londonTime} — <happened>. Next: <next>." ` +
        `You return the two parts. happened = what happened, cleaned, past tense, warm and ` +
        `plain (≤120 chars, no leading "Paused"). next = the inferred next step, imperative ` +
        `(≤60 chars). Written at maximum context, read at minimum context — future the user must ` +
        `resume from this line alone.`,
      `Task: ${title}\nRaw note: ${note}` +
        (previousContextLine ? `\nPrevious context line: ${previousContextLine}` : ""),
      {
        type: "object",
        properties: { happened: { type: "string" }, next: { type: "string" } },
        required: ["happened", "next"],
        additionalProperties: false,
      },
      300,
    );
    const dot = (s: string) => (/[.!?]$/.test(s.trim()) ? s.trim() : s.trim() + ".");
    return { contextLine: `Paused ${londonTime} — ${dot(parts.happened)} Next: ${dot(parts.next)}` };
  },
});

// ── draftFollowUp ────────────────────────────────────────────────────────────

/**
 * Done + follow-up (slice 5.5): the user completes a task and types one short line
 * of what should come back ("call them if no reply in 3 days"). The original
 * task is the context; the model drafts the follow-up task — and returns the
 * timing as RELATIVE hours (`wakeInHours`), which the client turns into a
 * concrete `snoozeUntil`. Relative-not-absolute keeps the model out of epoch
 * arithmetic (the polishNote lesson: return parts, compose in code).
 */
export const draftFollowUp = action({
  args: {
    ...apiKeyArg,
    originalTitle: v.string(),
    originalContext: v.optional(v.string()),
    instruction: v.string(),
  },
  returns: v.object({
    title: v.string(),
    size: sizeValidator,
    contextLine: v.string(),
    kickoffPrompt: v.string(),
    wakeInHours: v.number(), // 0 = actionable now; >0 = park until then
  }),
  handler: async (_ctx, { apiKey, originalTitle, originalContext, instruction }) => {
    requireKey(apiKey);
    const draft = await structured<{
      title: string;
      size: "xs" | "m" | "l";
      contextLine: string;
      kickoffPrompt: string;
      wakeInHours: number;
    }>(
      `${HELM_CONTEXT}\nThe user just completed a task and wants a follow-up minted from one short ` +
        `instruction. Draft the follow-up task. title = one imperative line (the follow-up ` +
        `action itself, not "follow up on X" if the instruction is more specific). ` +
        `contextLine = one line (≤140 chars) of "where this is at", referencing what the ` +
        `completed task established — future the user resumes from this line alone. ` +
        `kickoffPrompt = a ready-to-run instruction Claude Code could execute (imperative, ` +
        `self-contained, 1–3 sentences). wakeInHours = when this should SURFACE, in hours from ` +
        `now, taken from the instruction's timing ("in 3 days" → 72, "next week" → 168, ` +
        `"tomorrow" → 24); 0 if it's actionable immediately or no timing is given.`,
      `Completed task: ${originalTitle}` +
        (originalContext ? `\nWhere it was at: ${originalContext}` : "") +
        `\nFollow-up instruction: ${instruction}`,
      {
        type: "object",
        properties: {
          title: { type: "string" },
          size: { type: "string", enum: ["xs", "m", "l"] },
          contextLine: { type: "string" },
          kickoffPrompt: { type: "string" },
          // NB: structured outputs reject "minimum" on numbers — the ≥0 clamp lives below.
          wakeInHours: { type: "number" },
        },
        required: ["title", "size", "contextLine", "kickoffPrompt", "wakeInHours"],
        additionalProperties: false,
      },
      500,
    );
    // Belt-and-braces: schema minimum should hold, but a negative/NaN wake must
    // never become a snooze in the past.
    return { ...draft, wakeInHours: Number.isFinite(draft.wakeInHours) ? Math.max(0, draft.wakeInHours) : 0 };
  },
});

// ── parseSearch ──────────────────────────────────────────────────────────────

export const parseSearch = action({
  args: { ...apiKeyArg, question: v.string() },
  returns: v.object({
    filters: v.object({
      status: v.optional(statusValidator),
      areaKey: v.optional(v.string()),
      origin: v.optional(originValidator),
      needsReview: v.optional(v.boolean()),
      includeSnoozed: v.optional(v.boolean()),
    }),
    explanation: v.string(),
  }),
  handler: async (ctx, { apiKey, question }) => {
    requireKey(apiKey);
    const areas: Array<{ key: string; label: string }> = await ctx.runQuery(
      api.areas.listAreas,
      { apiKey },
    );

    // "any" = the dimension doesn't constrain — mapped to undefined below.
    const raw = await structured<{
      status: string;
      areaKey: string;
      origin: string;
      needsReview: string;
      includeSnoozed: string;
      explanation: string;
    }>(
      `${HELM_CONTEXT}\nTranslate a natural-language question about the user's tasks into list ` +
        `filters. Statuses: inbox (captured, untriaged), today (chosen for today), next ` +
        `(queued), waiting (blocked on someone else), someday (deferred), done, dropped. ` +
        `origin: planned = forward intentions, adhoc = after-the-fact completions. ` +
        `needsReview true = sweep proposals awaiting confirm. Use "any" for any dimension ` +
        `the question doesn't constrain. explanation = one short line starting "Reading that ` +
        `as:" describing the interpretation.`,
      question,
      {
        type: "object",
        properties: {
          status: {
            type: "string",
            enum: ["inbox", "today", "next", "waiting", "someday", "done", "dropped", "any"],
          },
          areaKey: { type: "string", enum: [...areas.map((a) => a.key), "any"] },
          origin: { type: "string", enum: ["planned", "adhoc", "any"] },
          needsReview: { type: "string", enum: ["true", "false", "any"] },
          includeSnoozed: { type: "string", enum: ["true", "false", "any"] },
          explanation: { type: "string" },
        },
        required: ["status", "areaKey", "origin", "needsReview", "includeSnoozed", "explanation"],
        additionalProperties: false,
      },
      300,
    );

    const opt = <T>(val: string, map: (s: string) => T): T | undefined =>
      val === "any" ? undefined : map(val);
    return {
      filters: {
        status: opt(raw.status, (s) => s as never),
        areaKey: opt(raw.areaKey, (s) => s),
        origin: opt(raw.origin, (s) => s as never),
        needsReview: opt(raw.needsReview, (s) => s === "true"),
        includeSnoozed: opt(raw.includeSnoozed, (s) => s === "true"),
      },
      explanation: raw.explanation,
    };
  },
});
