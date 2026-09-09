#!/usr/bin/env node
/**
 * Connect the optional Google Calendar mirror on the selected development deployment.
 * Use an OAuth web client with the redirect URI http://127.0.0.1:8765.
 * Set GOOGLE_CAL_CLIENT_ID and GOOGLE_CAL_CLIENT_SECRET in Convex first.
 * Run node scripts/google-cal-auth.mjs from the clone.
 */
import { createServer } from "node:http";
import { randomBytes, createHash, timingSafeEqual } from "node:crypto";
import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";
import { development } from "./lib/dev.mjs";
import { setSecret } from "./lib/keys.mjs";

export const REDIRECT = "http://127.0.0.1:8765";
const FAILURE = "Calendar connection failed. Check the OAuth client and development access, then run the helper again.";

/** One transaction. Invalid callbacks do not consume the legitimate request. */
export function authorizationFlow({ clientId, clientSecret, saveToken, fetchImpl = fetch }) {
  const state = randomBytes(32).toString("base64url");
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const authUrl = "https://accounts.google.com/o/oauth2/v2/auth?" + new URLSearchParams({
    client_id: clientId, redirect_uri: REDIRECT, response_type: "code",
    scope: "https://www.googleapis.com/auth/calendar.readonly", access_type: "offline",
    prompt: "consent", state, code_challenge: challenge, code_challenge_method: "S256",
  });
  let consumed = false;
  async function handle(req, res) {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    let url;
    try { url = new URL(req.url ?? "/", REDIRECT); } catch { res.writeHead(400).end("Invalid callback."); return false; }
    const supplied = Buffer.from(url.searchParams.get("state") ?? "");
    const expected = Buffer.from(state);
    if (req.method !== "GET" || url.origin !== REDIRECT || url.pathname !== "/" ||
        req.headers.host !== "127.0.0.1:8765" || supplied.length !== expected.length ||
        !timingSafeEqual(supplied, expected)) {
      res.writeHead(403).end("Invalid callback. Continue in the original consent tab.");
      return false;
    }
    if (consumed) { res.writeHead(409).end("This callback was already used."); return false; }
    consumed = true;
    try {
      const code = url.searchParams.get("code");
      if (!code || url.searchParams.has("error")) throw new Error(FAILURE);
      const response = await fetchImpl("https://oauth2.googleapis.com/token", {
        method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
        signal: AbortSignal.timeout(15_000),
        body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret,
          redirect_uri: REDIRECT, grant_type: "authorization_code", code_verifier: verifier }),
      });
      if (!response.ok) throw new Error(FAILURE);
      const data = await response.json();
      if (typeof data.refresh_token !== "string" || !data.refresh_token || /[\r\n]/.test(data.refresh_token)) throw new Error(FAILURE);
      await saveToken(data.refresh_token);
      res.end("Helm calendar connected. Close this tab.");
      return true;
    } catch {
      // Never propagate token responses, subprocess arguments, or credential errors.
      res.writeHead(502).end(FAILURE);
      throw new Error(FAILURE);
    }
  }
  return { authUrl, handle };
}

async function main() {
  if (process.argv.slice(2).includes("--help")) {
    console.log("Usage: node scripts/google-cal-auth.mjs\nConnect Google Calendar on the configured cloud development deployment.\nRegister http://127.0.0.1:8765 as the OAuth web client's redirect URI.\nSet GOOGLE_CAL_CLIENT_ID and GOOGLE_CAL_CLIENT_SECRET in Convex first.");
    return;
  }
  if (process.argv.length > 2) throw new Error(FAILURE);
  const dev = development();
  const clientId = dev.cli(["env", "get", "GOOGLE_CAL_CLIENT_ID"]);
  const clientSecret = dev.cli(["env", "get", "GOOGLE_CAL_CLIENT_SECRET"]);
  if (!clientId || !clientSecret) throw new Error(FAILURE);
  const flow = authorizationFlow({ clientId, clientSecret,
    saveToken: token => setSecret(dev, "GOOGLE_CAL_REFRESH_TOKEN", token) });
  await new Promise((resolve, reject) => {
    let timer;
    const server = createServer(async (req, res) => {
      try { if (await flow.handle(req, res)) finish(); }
      catch { finish(new Error(FAILURE)); }
    });
    function finish(error) {
      clearTimeout(timer);
      server.close();
      server.closeIdleConnections();
      if (error) reject(error); else resolve();
    }
    server.on("error", () => finish(new Error(FAILURE)));
    server.listen(8765, "127.0.0.1", () => {
      timer = setTimeout(() => finish(new Error(FAILURE)), 5 * 60_000);
      console.log("Open this consent URL in your browser:\n" + flow.authUrl);
      const command = process.platform === "darwin" ? "open" : "xdg-open";
      const child = spawn(command, [flow.authUrl], { stdio: "ignore" });
      child.on("error", () => {}); // The displayed URL remains usable without a desktop opener.
      child.unref();
    });
  });
  console.log("Calendar refresh token stored and verified. No token was printed.");
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(() => { console.error(FAILURE); process.exitCode = 1; });
}
