/** Isolated actual-helper and action tests; no Google account or backend writes. */
import assert from "node:assert/strict";
import { build } from "esbuild";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
const bundled = await build({ stdin: { contents: 'export { loadCalendarWindow } from "./convex/lib/calendar.ts"; export { syncGoogleCalendar } from "./convex/meetings.ts";', resolveDir: root }, bundle: true, platform: "node", format: "esm", write: false, logLevel: "silent" });
const { loadCalendarWindow, syncGoogleCalendar } = await import("data:text/javascript;base64," + Buffer.from(bundled.outputFiles[0].text).toString("base64"));
const hour = 3600_000, from = 0, until = 48 * hour;
const event = (id, start = hour, end = 2 * hour) => ({ id, summary: "Fixture meeting", start: { dateTime: new Date(start).toISOString() }, end: { dateTime: new Date(end).toISOString() } });
const response = (body, status = 200) => new Response(JSON.stringify(body), { status });
let calls = [];
const pages = (values) => async (url, options) => { calls.push([new URL(url), options]); const next = values.shift(); if (!next) throw new Error("Unexpected extra page"); return response(next.body ?? next, next.status ?? 200); };
const read = request => loadCalendarWindow("fixture-access-token", from, until, request);
assert.deepEqual((await read(pages([{ items: [event("a")], nextPageToken: "second" }, { items: [event("b")] }]))).map(m => m.eventId), ["a", "b"]);
assert.equal(calls.length, 2); assert.equal(calls[1][0].searchParams.get("pageToken"), "second");
assert.equal(calls[0][0].searchParams.get("singleEvents"), "true"); assert.equal(calls[0][0].searchParams.get("maxResults"), "100");
assert.equal(calls[0][0].searchParams.has("updatedMin"), false);
assert.equal((await read(pages([{ nextPageToken: "next" }, { items: [event("after-empty")] }]))).length, 1);
assert.equal((await read(pages([{ items: [{ status: "cancelled" }, { start: { date: "1970-01-01" }, end: { date: "1970-01-02" } }] }]))).length, 0);
await assert.rejects(read(pages([{ items: [event("a")], nextPageToken: "next" }, { status: 500, body: { error: "provider details must not escape" } }])), /events fetch failed \(500\)/);
await assert.rejects(read(pages([{ nextPageToken: "same" }, { nextPageToken: "same" }])), /repeated page token/);
await assert.rejects(read(pages(Array.from({ length: 20 }, (_, i) => ({ nextPageToken: String(i) })))), /20 pages/);
await assert.rejects(read(pages([{ items: Array.from({ length: 1001 }, (_, i) => event(String(i))) }])), /1000 events/);
await assert.rejects(read(pages([{ items: [event("same")], nextPageToken: "next" }, { items: [event("same")] }])), /duplicate event ID/);
await assert.rejects(read(pages([{ items: [{ ...event("bad"), start: { dateTime: "invalid" } }] }])), /invalid time/);
await assert.rejects(read(pages([{ items: [event("outside", until, until + hour)] }])), /outside its window/);
await assert.rejects(read(pages([{ items: {} }])), /invalid event page/);
for (const raw of [null, [], false, 42, "unexpected"]) await assert.rejects(read(async () => response(raw)), /invalid event page/);
await assert.rejects(read(pages([{ items: [{ ...event("long-title"), summary: "x".repeat(2001) }] }])), /oversized/);
assert.equal((await read(pages([{ items: [event("ongoing", -3 * hour, hour)] }])))[0].startAt, -3 * hour);

// The actual action must not persist a first page when a later page fails.
const envNames = ["GOOGLE_CAL_CLIENT_ID", "GOOGLE_CAL_CLIENT_SECRET", "GOOGLE_CAL_REFRESH_TOKEN"];
const saved = Object.fromEntries(envNames.map(name => [name, process.env[name]])), originalFetch = globalThis.fetch;
try {
  for (const name of envNames) delete process.env[name];
  let writes = 0;
  assert.deepEqual(await syncGoogleCalendar._handler({ runMutation: async () => writes++ }), { synced: 0, skipped: true });
  for (const name of envNames) process.env[name] = "fixture-only";
  const timed = event("first", Date.now() + hour, Date.now() + 2 * hour);
  const exchange = [{ access_token: "fixture-only-token" }, { items: [timed], nextPageToken: "next" }, { status: 503, body: {} }];
  globalThis.fetch = async () => { const next = exchange.shift(); return response(next.body ?? next, next.status ?? 200); };
  await assert.rejects(syncGoogleCalendar._handler({ runMutation: async () => writes++ }), /events fetch failed/);
  assert.equal(writes, 0, "failed pagination makes no backend mutation");
  for (const raw of [null, [], false, 42, "unexpected"]) {
    let tokenRequest = true;
    globalThis.fetch = async () => { if (tokenRequest) { tokenRequest = false; return response({ access_token: "fixture-only" }); } return response(raw); };
    await assert.rejects(syncGoogleCalendar._handler({ runMutation: async () => writes++ }), /invalid event page/);
    assert.equal(writes, 0, "malformed response cannot clear the mirror");
  }
  const complete = [{ access_token: "fixture-only-token" }, { items: [timed], nextPageToken: "next" }, { items: [event("second", Date.now() + 3 * hour, Date.now() + 4 * hour)] }];
  globalThis.fetch = async () => response(complete.shift());
  const result = await syncGoogleCalendar._handler({ runMutation: async (_fn, args) => { writes++; assert.equal(args.meetings.length, 2); } });
  assert.equal(writes, 1); assert.deepEqual(result, { synced: 2, skipped: false });
} finally {
  globalThis.fetch = originalFetch;
  for (const name of envNames) { if (saved[name] === undefined) delete process.env[name]; else process.env[name] = saved[name]; }
}
console.log("Calendar mirror fixtures passed: complete pagination, failures before persistence, bounds, overlap, and missing credentials.");
