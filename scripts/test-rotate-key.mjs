/** Rotates ONLY the configured development credentials. Run deliberately. */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { development } from "./lib/dev.mjs";
const dev = development();
const read = () => ["HELM_API_KEY", "HELM_SURFACE_TOKEN"].map(name => dev.cli(["env", "get", name]));
const before = read();
const run = args => execFileSync(process.execPath, [dev.root + "/scripts/rotate-key.mjs", ...args],
  { cwd: dev.root, env: dev.env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
const preview = run(["--dry-run"]);
assert.ok(read().every((v,i) => v === before[i]), "dry-run preserves credentials");
const output = run(["--yes"]);
const after = read();
assert.ok(after.every(v => /^[0-9a-f]{48}$/.test(v)), "new credentials use the required format");
assert.ok(after[0] !== after[1] && after.every((v,i) => v !== before[i]), "credentials are distinct and replaced");
assert.ok([...before,...after].filter(Boolean).every(v => !(preview+output).includes(v)), "command output contains no credential");
const client = new ConvexHttpClient(dev.url, {logger:false});
assert.ok((await client.query(makeFunctionReference("settings:get"),{apiKey:after[0]})).timezone);
let denied=false;
try { await client.query(makeFunctionReference("settings:get"),{apiKey:before[0]}); }
catch(e) { denied = /unauthorized/i.test(String(e.data ?? e.message)); }
assert.ok(denied,"old API key is rejected");
const site=dev.url.replace(".convex.cloud",".convex.site");
assert.ok((await fetch(site+"/brief",{headers:{"X-Helm-Token":before[1]}})).status===401,"old surface token is rejected");
assert.ok((await fetch(site+"/brief",{headers:{"X-Helm-Token":after[1]}})).status===200,"new surface token works");
console.log("Rotation test passed: dry-run, strong independent credentials, no secret output, new credentials accepted, old credentials rejected.");
