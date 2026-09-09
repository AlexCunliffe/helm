#!/usr/bin/env node
/**
 * One-shot Google Calendar OAuth for Helm (4.2) — playground-proof.
 *
 * Mints a refresh token bound to YOUR OAuth client (the exchange uses the
 * exact client id/secret already stored on the deployment, so
 * `unauthorized_client` cannot happen) and stores it back with
 * `npx convex env set`. Run it yourself from the repo root:
 *
 *   node scripts/google-cal-auth.mjs
 *
 * One-time prereq: in Google Cloud console → Credentials → your OAuth client
 * (Web application) → Authorised redirect URIs → add
 *   http://localhost:8765
 */
import { createServer } from "node:http";
import { execFileSync, exec } from "node:child_process";

const env = (n) =>
  execFileSync("npx", ["convex", "env", "get", n], { encoding: "utf8" }).trim();
const CLIENT_ID = env("GOOGLE_CAL_CLIENT_ID");
const CLIENT_SECRET = env("GOOGLE_CAL_CLIENT_SECRET");
const REDIRECT = "http://localhost:8765";
const SCOPE = "https://www.googleapis.com/auth/calendar.readonly";

const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
  client_id: CLIENT_ID,
  redirect_uri: REDIRECT,
  response_type: "code",
  scope: SCOPE,
  access_type: "offline", // ask for a refresh token…
  prompt: "consent", // …and force re-issue even if previously granted
})}`;

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", REDIRECT);
  const code = url.searchParams.get("code");
  if (!code) {
    res.writeHead(404).end();
    return;
  }
  res.end("Helm calendar connected — you can close this tab.");
  server.close();

  const tok = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT,
      grant_type: "authorization_code",
    }),
  });
  const data = await tok.json();
  if (!data.refresh_token) {
    console.error("No refresh_token in Google's response:");
    console.error(JSON.stringify(data, null, 2).slice(0, 400));
    process.exit(1);
  }
  execFileSync("npx", ["convex", "env", "set", "GOOGLE_CAL_REFRESH_TOKEN", data.refresh_token], {
    stdio: "inherit",
  });
  console.log("\nrefresh token minted by YOUR client and stored ✅");
  console.log("verify with: npx convex run meetings:syncGoogleCalendar");
  process.exit(0);
});

server.listen(8765, () => {
  console.log("Opening Google consent in your browser…");
  console.log("(if it doesn't open, paste this URL yourself)\n");
  console.log(authUrl + "\n");
  exec(`open "${authUrl}"`);
});
