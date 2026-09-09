/**
 * Function-level auth (slice 4.1, D15). Helm is single-user, so every public
 * function demands one shared API key — an `apiKey` arg compared (timing-safe)
 * against the `HELM_API_KEY` deployment secret. The glass, MCP server,
 * SessionEnd hook and regression harness all present the same key; internal
 * functions (cron waker, test janitor) never need one.
 *
 * Authentication is required by default. HELM_ALLOW_ANON=1 is an explicit
 * development opt-out; every anonymous call emits a warning.
 */
import { ConvexError } from "convex/values";

/**
 * Timing-safe string equality: XOR-folds over the longer length so neither a
 * length mismatch nor an early character difference short-circuits (`===`
 * bails at the first differing char, leaking prefix length via timing).
 */
export function timingSafeEqual(a: string, b: string): boolean {
  const len = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < len; i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

/**
 * Gate a public function. Call first, before touching the db.
 * Throws ConvexError (an application error), not a plain Error: production
 * deployments redact plain Error messages to "Server Error", which would blind
 * the glass's `/unauthorized/` detection and stop the key gate re-opening on a
 * rotated key. ConvexError data survives to the client on prod.
 */
export function requireKey(apiKey: string | undefined): void {
  if (process.env.HELM_ALLOW_ANON === "1") {
    console.warn("HELM_ALLOW_ANON=1: public Helm functions permit unauthenticated access.");
    return;
  }
  const expected = process.env.HELM_API_KEY;
  if (!expected) {
    throw new ConvexError("unauthorized: HELM_API_KEY is not configured (failing closed)");
  }
  if (!apiKey || !timingSafeEqual(apiKey, expected)) {
    throw new ConvexError("unauthorized: missing or invalid apiKey");
  }
}
