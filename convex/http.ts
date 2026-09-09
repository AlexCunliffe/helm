/**
 * Token-guarded HTTP surface (docs/04). Dumb glass surfaces (iPhone widget,
 * desk screen) read JSON here — no MCP needed. The AI actors use MCP; glass
 * gets a URL (docs/02). Auth is a shared secret in Convex env (HELM_SURFACE_TOKEN),
 * never in the repo. The token travels ONLY in the X-Helm-Token header — a
 * query-param token would leak into server logs, browser history and referrers
 * (H3 hardening; writes for the glass arrive via Convex Auth in slice 4.1, so
 * this token never guards anything beyond read + propose).
 *
 *   GET  /brief   → the brief() payload, read-only JSON.
 *   POST /ingest  → generic capture webhook (forward something in → a proposed
 *                   task, needsReview). The first place server-side AI could
 *                   later parse raw text (docs/07); v1 accepts already-
 *                   structured JSON and proposes it for review.
 */
import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";
import { timingSafeEqual } from "./lib/auth";
import { GLASS_HTML } from "./glass";

// Server-side hop: http actions present the function-level key themselves —
// the surface token (checked above the waterline) never becomes a write key.
const fnKey = () => process.env.HELM_API_KEY;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Helm-Token",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...CORS },
  });
}

/** Shared surface token, header-only (query params leak into logs/history). */
function authorized(req: Request): boolean {
  const expected = process.env.HELM_SURFACE_TOKEN;
  if (!expected) return false; // fail closed if the secret isn't set
  const provided = req.headers.get("x-helm-token") ?? "";
  return timingSafeEqual(provided, expected);
}

const http = httpRouter();

http.route({
  path: "/brief",
  method: "OPTIONS",
  handler: httpAction(async () => new Response(null, { status: 204, headers: CORS })),
});

http.route({
  path: "/brief",
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    if (!authorized(req)) return json({ error: "unauthorized" }, 401);
    const brief = await ctx.runQuery(api.queries.brief, { apiKey: fnKey() });
    return json(brief);
  }),
});

http.route({
  path: "/ingest",
  method: "OPTIONS",
  handler: httpAction(async () => new Response(null, { status: 204, headers: CORS })),
});

http.route({
  path: "/ingest",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    if (!authorized(req)) return json({ error: "unauthorized" }, 401);

    let body: Record<string, unknown>;
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return json({ error: "invalid JSON body" }, 400);
    }
    if (!body || typeof body.title !== "string" || body.title.trim() === "") {
      return json({ error: "title (string) is required" }, 400);
    }

    // Whitelist the capture fields an external caller may set. Defaults make an
    // ingested item a proposed task (needsReview) tagged source:"ingest".
    const result = await ctx.runMutation(api.tasks.capture, {
      apiKey: fnKey(),
      title: body.title as string,
      note: typeof body.note === "string" ? body.note : undefined,
      areaKey: typeof body.areaKey === "string" ? body.areaKey : undefined,
      contextLine: typeof body.contextLine === "string" ? body.contextLine : undefined,
      source: typeof body.source === "string" ? body.source : "ingest",
      sourceRef:
        body.sourceRef && typeof body.sourceRef === "object"
          ? (body.sourceRef as { url?: string; threadId?: string; label?: string })
          : undefined,
      dedupeKey: typeof body.dedupeKey === "string" ? body.dedupeKey : undefined,
      needsReview: typeof body.needsReview === "boolean" ? body.needsReview : true,
    });
    return json(result);
  }),
});

// The glass (4.7, D10): Convex serves its own front end, so page and backend
// deploy atomically. Today this is the design-complete PROTOTYPE on sample
// data (no secrets in it — served open); the wired glass replaces the same
// route and authenticates client-side with the API key before it can read
// anything real.
http.route({
  path: "/glass",
  method: "GET",
  handler: httpAction(async () => {
    return new Response(GLASS_HTML, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store", // one deploy = one page version, always fresh
      },
    });
  }),
});

export default http;
