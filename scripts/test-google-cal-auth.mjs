/** Isolated OAuth callback tests. No Google account or deployment is contacted. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { authorizationFlow, REDIRECT } from "./google-cal-auth.mjs";
import { setSecret } from "./lib/keys.mjs";

function response() {
  return { status: 200, body: "", headers: {}, ended: false,
    setHeader(key, value) { this.headers[key] = value; },
    writeHead(status) { this.status = status; return this; },
    end(body = "") { this.body = body; this.ended = true; return this; } };
}
function request(url) { return { url, method: "GET", headers: { host: new URL(REDIRECT).host } }; }
function callback(flow, values = {}) {
  const state = new URL(flow.authUrl).searchParams.get("state");
  return "/?" + new URLSearchParams({ state, code: "fixture-code", ...values });
}
let fetches = 0, stored, exchanged;
const flow = authorizationFlow({ clientId: "fixture-client", clientSecret: "fixture-client-secret",
  fetchImpl: async (_url, options) => { fetches++; exchanged = options.body;
    return { ok: true, json: async () => ({ refresh_token: "fixture-refresh-token" }) }; },
  saveToken: async token => { stored = token; } });
const auth = new URL(flow.authUrl).searchParams;
assert.equal(auth.get("redirect_uri"), REDIRECT);
assert.equal(auth.get("code_challenge_method"), "S256");
assert.ok(!flow.authUrl.includes("fixture-client-secret"));
assert.ok(auth.get("state").length >= 43);
for (const url of ["/?code=foreign", "/?state=wrong&code=foreign", "/wrong" + callback(flow), "https://foreign.test" + callback(flow)]) {
  const res = response();
  assert.equal(await flow.handle(request(url), res), false);
  assert.equal(res.status, 403);
}
assert.equal(fetches, 0);
const res = response();
assert.equal(await flow.handle(request(callback(flow)), res), true);
assert.equal(stored, "fixture-refresh-token");
assert.ok(res.ended && res.body.includes("connected"));
assert.equal(createHash("sha256").update(exchanged.get("code_verifier")).digest("base64url"), auth.get("code_challenge"));
assert.ok(!flow.authUrl.includes(exchanged.get("code_verifier")));
assert.equal(await flow.handle(request(callback(flow)), response()), false);
assert.equal(fetches, 1);

for (const mode of ["exchange", "missing-refresh", "save", "denied"]) {
  const secret = "fixture-never-disclose";
  let writes = 0;
  const failed = authorizationFlow({ clientId: "fixture-client", clientSecret: secret,
    fetchImpl: async () => {
      if (mode === "exchange") throw new Error(secret);
      return { ok: true, json: async () => mode === "missing-refresh" ? { access_token: secret } : { refresh_token: secret } };
    }, saveToken: async () => { writes++; if (mode === "save") throw new Error("Command failed with " + secret); } });
  const output = response();
  await assert.rejects(failed.handle(request(callback(failed, mode === "denied" ? { error: secret } : {})), output), error => !error.message.includes(secret));
  assert.equal(output.status, 502);
  assert.ok(!output.body.includes(secret));
  assert.equal(writes, mode === "save" ? 1 : 0);
}
let saved;
setSecret({ cli(args, options) {
  assert.ok(!args.includes("fixture-refresh"));
  if (args[1] === "set") { saved = options.input; return ""; }
  return saved;
} }, "GOOGLE_CAL_REFRESH_TOKEN", "fixture-refresh");
assert.equal(saved, "fixture-refresh");
console.log("Calendar OAuth fixtures passed: state, PKCE, replay, failure redaction, and stdin credential storage.");
