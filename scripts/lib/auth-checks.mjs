import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { development } from "./dev.mjs";

/** Exhaustive runtime auth check against metadata from the selected dev deployment.
 * Environment values remain in memory and are restored even after a failure. */
export async function checkAuthentication() {
  const dev = development(), apiKey = dev.getKey();
  const prefix = "test:auth:" + randomUUID() + ":";
  const client = new ConvexHttpClient(dev.url, { logger: false });
  const saved = {};
  for (const name of ["HELM_API_KEY", "HELM_SURFACE_TOKEN", "HELM_ALLOW_ANON", "HELM_REQUIRE_KEY"])
    saved[name] = dev.cli(["env", "get", name]);
  const getSpec = () => {
    try { return JSON.parse(execFileSync("npx", ["--no-install", "convex", "function-spec"],
      { cwd: dev.root, env: dev.env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] })); }
    catch { throw new Error("Cannot read development function metadata."); }
  };
  const spec = getSpec(); assert.equal(spec.url, dev.url, "function metadata must match development");
  const functions = spec.functions.filter(f => f.visibility?.kind === "public" && ["Query", "Mutation", "Action"].includes(f.functionType));
  assert.ok(functions.length > 0, "public functions discovered");
  const fixture = await client.mutation(makeFunctionReference("tasks:capture"),
    { apiKey, title: "TEST auth gate", dedupeKey: prefix + "fixture" });
  function example(v) {
    switch (v.type) {
      case "object": return Object.fromEntries(Object.entries(v.value).filter(([, f]) => !f.optional).map(([k,f]) => [k,example(f.fieldType)]));
      case "array": return [];
      case "union": return example(v.value[0]);
      case "id": assert.equal(v.tableName,"tasks","add a safe fixture for a new required ID table"); return fixture.taskId;
      case "string": return "TEST auth";
      case "number": return 0;
      case "boolean": return false;
      case "literal": return v.value;
      case "null": case "any": return null;
      default: throw new Error(`Add an auth-test fixture for validator ${v.type}.`);
    }
  }
  const cases = functions.map(f => {
    assert.ok(f.args.value.apiKey, `${f.identifier} declares apiKey`);
    const args = example(f.args);
    if (f.args.value.dedupeKey) args.dedupeKey = prefix + f.identifier;
    if (f.args.value.date) args.date = "1900-01-01";
    if (f.args.value.key) args.key = "test-auth-area";
    return { name: f.identifier.replace(/\.js:/, ":"), kind: f.functionType.toLowerCase(), args };
  });
  const passed = [];
  async function rejected(c, key) {
    let unauthorized = false;
    try { await client[c.kind](makeFunctionReference(c.name), { ...c.args, ...(key ? { apiKey: key } : {}) }); }
    catch (e) { unauthorized = /unauthorized/i.test(String(e.data ?? e.message)); }
    assert.ok(unauthorized, `${c.name} rejects with unauthorized`);
  }
  const restore = name => saved[name] ? dev.cli(["env", "set", name], { input: saved[name] }) : dev.cli(["env", "remove", name]);
  try {
    // An old migration flag must not open a new installation.
    dev.cli(["env", "remove", "HELM_ALLOW_ANON"]);
    dev.cli(["env", "remove", "HELM_REQUIRE_KEY"]);
    for (const c of cases) { await rejected(c); await rejected(c, "wrong"); }
    passed.push(`auth: all ${cases.length} public functions reject missing and wrong keys`);
    dev.cli(["env", "remove", "HELM_API_KEY"]);
    dev.cli(["env", "remove", "HELM_SURFACE_TOKEN"]);
    for (const c of cases) await rejected(c, apiKey);
    passed.push(`auth: all ${cases.length} public functions fail closed with no configured key`);
    const site = dev.url.replace(".convex.cloud", ".convex.site");
    assert.equal((await fetch(site + "/glass")).status, 200);
    assert.equal((await fetch(site + "/brief")).status, 401);
    assert.equal((await fetch(site + "/ingest", {method:"POST",body:"{}"})).status, 401);
    passed.push("auth: glass is public; HTTP data routes close without a surface token");
    dev.cli(["env", "set", "HELM_ALLOW_ANON", "1"]);
    const logs=[];
    const log=(...parts)=>logs.push(parts.join(" "));
    const anon = new ConvexHttpClient(dev.url, {logger:{log,warn:log,error:log,logVerbose:log}});
    await anon.query(makeFunctionReference("areas:listAreas"),{});
    await anon.query(makeFunctionReference("areas:listAreas"),{});
    assert.ok(logs.filter(line=>line.includes("HELM_ALLOW_ANON=1")).length>=2,"anonymous access warns on every call");
    passed.push("auth: explicit anonymous opt-out warns on each call");
  } finally {
    // Close anonymous access before restoring the normal credentials.
    const failures = [];
    for (const action of [() => dev.cli(["env", "remove", "HELM_ALLOW_ANON"]),
      ...["HELM_API_KEY", "HELM_SURFACE_TOKEN", "HELM_REQUIRE_KEY", "HELM_ALLOW_ANON"].map(name => () => restore(name)),
      () => dev.cli(["run", "testing:purgeTestData", JSON.stringify({prefix,dates:[]})])]) {
      try { action(); } catch { failures.push("restore"); }
    }
    if (failures.length) throw new Error("Auth-test restoration failed. Check the development credentials and ensure HELM_ALLOW_ANON is disabled.");
  }
  assert.ok((await client.query(makeFunctionReference("settings:get"),{apiKey})).timezone);
  passed.push("auth: keyed access works after credentials are restored");
  return passed;
}
