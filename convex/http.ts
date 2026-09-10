/**
 * Token-guarded HTTP surface (docs/04). Dumb glass surfaces (iPhone widget,
 * desk screen) read JSON here — no MCP needed. The AI actors use MCP; glass
 * gets a URL (docs/02). Auth is a shared secret in Convex env (HELM_SURFACE_TOKEN),
 * never in the repo. The token travels ONLY in the X-Helm-Token header — a
 * query-param token would leak into server logs, browser history and referrers
 * (H3 hardening; writes for the glass arrive via Convex Auth in slice 4.1, so
 * this token only guards brief reads and bounded proposals).
 *
 *   GET  /brief   → the brief() payload, read-only JSON.
 *   POST /ingest  → generic capture webhook (forward something in → a proposed
 *                   task, needsReview). The first place server-side AI could
 *                   later parse raw text (docs/07); v1 accepts already-
 *                   structured JSON and proposes it for review.
 */
import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { parseIngest } from "./lib/ingest";
import { timingSafeEqual } from "./lib/auth";
import { boundedJson, HttpCapacityError } from "./lib/httpJson";
import { GLASS_HTML } from "./glass";

// Server-side hop: http actions present the function-level key themselves —
// the surface token (checked above the waterline) never becomes an unrestricted task write key.
const fnKey = () => process.env.HELM_API_KEY;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Helm-Token",
};

function json(body: unknown, status = 200): Response {
  let encoded: string | undefined;
  try { encoded = boundedJson(body); }
  catch (error) {
    if (!(error instanceof HttpCapacityError)) throw error;
    status = 413;
    encoded = JSON.stringify({ error: "HTTP JSON exceeds 8 MiB. Reduce brief display caps or use paginated task reads." });
  }
  return new Response(encoded, {
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

    // Bound the byte stream before decoding JSON. Do not buffer an arbitrary request.
    const reader=req.body?.getReader();
    if(!reader)return json({error:"JSON body is required"},400);
    const chunks:Uint8Array[]=[];let length=0;
    try{
      while(true){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;
        if(length>32768){await reader.cancel();return json({error:"Body exceeds 32 KiB"},413);}chunks.push(value);}
      const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
      const args=parseIngest(JSON.parse(new TextDecoder().decode(bytes)));
      const result=await ctx.runMutation(internal.ingest.propose,args);
      return json(result);
    }catch{return json({error:"Invalid proposal. Check field types, lengths, source URL, and area key."},400);}
    finally{reader.releaseLock();}
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
  handler: httpAction(async (_ctx, req) => {
    const clientOrigin = new URL(req.url).origin.replace(".convex.site", ".convex.cloud");
    const csp = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; " +
      `connect-src ${clientOrigin} ${clientOrigin.replace("https:", "wss:")}; ` +
      "img-src data:; base-uri 'none'; frame-ancestors 'none'; form-action 'none'";
    return new Response(GLASS_HTML, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Security-Policy": csp,
        "Referrer-Policy": "no-referrer",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "no-store", // one deploy = one page version, always fresh
      },
    });
  }),
});

export default http;
