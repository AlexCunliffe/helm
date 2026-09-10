/** Encoded HTTP limits: use native JSON/UTF-8 as the independent boundary oracle. */
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";
const root = fileURLToPath(new URL("../", import.meta.url));
const scratch = mkdtempSync(join(tmpdir(), "helm-http-test-"));
const priorToken = process.env.HELM_SURFACE_TOKEN;
let checks = 0;
try {
  const built = await build({ stdin: { contents: 'export * from "./convex/lib/httpJson.ts"; export {default as http} from "./convex/http.ts";', resolveDir: root }, bundle: true, platform: "node", format: "esm", write: false });
  const file = join(scratch, "fixture.mjs"); writeFileSync(file, built.outputFiles[0].text);
  const { boundedJson, HttpCapacityError, http } = await import(pathToFileURL(file));
  const shared = { message: "shared" };
  const values = [null, true, false, 12.5, NaN, "", "\0\n\r\t\"\\", "Résumé 🌿", "\ud800", "\udfff", [], {},
    [undefined, null, , false], { omitted: undefined, "": "empty key", nested: [1, { x: 2 }] },
    { "escaped\n🌿": "value", twice: [shared, shared] }];
  for (const value of values) {
    const expected = JSON.stringify(value), bytes = Buffer.byteLength(expected);
    assert.equal(boundedJson(value, bytes), expected); checks++;
    assert.throws(() => boundedJson(value, bytes - 1), HttpCapacityError); checks++;
  }
  process.env.HELM_SURFACE_TOKEN = "test-only-token";
  const handler = http.lookup("/brief", "GET")[0];
  const request = () => new Request("https://fixture.invalid/brief", { headers: { "X-Helm-Token": "test-only-token" } });
  const small = { date: "2026-01-01", note: "All text: 🌿\0", counts: { today: 0 } };
  const ok = await handler._handler({ runQuery: async () => small }, request());
  assert.equal(ok.status, 200); assert.deepEqual(await ok.json(), small); checks++;
  const task = { note: "\0".repeat(800000) };
  const large = { pick: task, today: [task, task, task], wins: [task, task, task], ageing: [task, task, task] };
  const rejected = await handler._handler({ runQuery: async () => large }, request());
  assert.equal(rejected.status, 413); assert((await rejected.text()).length < 200); checks++;
  assert.equal(rejected.headers.get("Cache-Control"), "no-store");
  assert.equal(rejected.headers.get("Access-Control-Allow-Origin"), "*"); checks++;
  const denied = await handler._handler({ runQuery: () => { throw Error("Auth must run before querying"); } }, new Request("https://fixture.invalid/brief"));
  assert.equal(denied.status, 401); checks++;
  console.log(`HTTP output fixtures passed: ${checks} checks.`);
} finally {
  if (priorToken === undefined) delete process.env.HELM_SURFACE_TOKEN; else process.env.HELM_SURFACE_TOKEN = priorToken;
  rmSync(scratch, { recursive: true, force: true });
}
