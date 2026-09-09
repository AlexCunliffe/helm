/** Real stdio MCP tests against the configured dev deployment. No key output. */
import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { development } from "../scripts/lib/dev.mjs";
const dev = development();
const apiKey = dev.getKey();
const client = new Client({ name: "helm-test", version: "1.0.0" });
const transport = new StdioClientTransport({ command: process.execPath, args: [dev.root + "/mcp/helm-mcp.mjs"],
  env: { ...dev.env, HELM_CONVEX_URL: dev.url, HELM_API_KEY: apiKey }, stderr: "pipe" });
const prefix = "test:mcp:";
const purge = () => JSON.parse(dev.cli(["run", "testing:purgeTestData", JSON.stringify({ prefix, dates: [] })]));
const call = async (name, args = {}) => {
  const result = await client.callTool({ name, arguments: args });
  assert.ok(!result.isError, `${name} succeeds`);
  return JSON.parse(result.content[0].text);
};
let saved;
try {
  purge();
  await client.connect(transport);
  const { tools } = await client.listTools();
  for (const name of ["getSettings", "updateSettings", "advanceWatermark", "brief", "capture", "chooseToday", "confirmProposed",
    "dayLog", "defer", "get", "getCheckin", "getWatermark", "inbox", "list", "listAreas", "logCompletion",
    "markDone", "reconcileDay", "reconcileOutstanding", "setStatus", "snooze", "todaysPick", "update", "waiting", "wake",
    "merge", "connect", "disconnect", "delegate"])
    assert.ok(tools.some(t => t.name === name), `${name} is registered`);
  const captureSchema = tools.find(tool => tool.name === "capture").inputSchema;
  assert.deepEqual(captureSchema.properties.status.enum, ["inbox", "today", "next", "waiting", "someday"]);
  for (const status of ["done", "dropped"]) {
    const result = await client.callTool({ name: "capture", arguments: { title: "TEST invalid terminal capture", status, dedupeKey: prefix + "invalid-" + status } });
    assert.equal(result.isError, true, "terminal capture input is rejected at the MCP boundary");
  }
  saved = await call("getSettings");
  const changed = await call("updateSettings", { patch: { owner: { shortName: "Sam" }, timezone: "Asia/Kathmandu",
    sources: [{ key: "gcal", label: "Calendar", kind: "calendar", enabled: true, mcpServer: "calendar", notes: "Read prep events." }],
    caps: { focusMinutes: 35 }, hook: { titleChars: 95 } } });
  assert.equal(changed.owner.shortName, "Sam");
  assert.equal(changed.owner.name, saved.owner.name);
  assert.equal(changed.timezone, "Asia/Kathmandu");
  assert.equal(changed.caps.focusMinutes, 35);
  assert.equal(changed.hook.titleChars, 95);
  assert.equal((await call("getSettings")).sources[0].mcpServer, "calendar");
  const invalid = await client.callTool({ name: "updateSettings", arguments: { patch: { timezone: "invalid/zone" } } });
  assert.equal(invalid.isError, true);
  const typo = await client.callTool({ name: "updateSettings", arguments: { patch: { timeZone: "UTC" } } });
  assert.equal(typo.isError, true);
  assert.equal((await call("getSettings")).timezone, "Asia/Kathmandu");
  const cleared = await call("updateSettings", { patch: { caps: null, workday: { eveningWatchFrom: null } } });
  assert.equal(cleared.caps, undefined);
  assert.equal(cleared.workday.eveningWatchFrom, undefined);
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kathmandu", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  assert.equal((await call("brief")).date, date);
  const area = (await call("listAreas"))[0];
  assert.ok(area, "seed at least one area first");
  const args = { title: "TEST MCP capture", areaKey: area.key, dedupeKey: prefix + "capture" };
  const first = await call("capture", args), second = await call("capture", args);
  assert.equal(first.created, true); assert.equal(second.created, false); assert.equal(second.taskId, first.taskId);
  assert.ok(Array.isArray(await call("list", { areaKey: area.key })));
  const bad = await client.callTool({ name: "get", arguments: { id: "not-a-real-id" } });
  assert.equal(bad.isError, true);
  assert.ok(!JSON.stringify(bad).includes(apiKey), "tool errors must not expose the API key");
  console.log("MCP tests passed: settings schemas, round-trip, validation, configured date, capture, and dedupe.");
} finally {
  try { if (saved) await call("updateSettings", { patch: { ...saved, caps: null, workday: { ...saved.workday, eveningWatchFrom: saved.workday.eveningWatchFrom ?? null } } }).then(async () => {
    if (saved.caps) await call("updateSettings", { patch: { caps: saved.caps } });
  });
  } finally { await client.close(); purge(); }
}
