/**
 * Integration smoke test for the Helm MCP server. Spawns helm-mcp.mjs over
 * stdio, lists tools, and exercises a read (brief) + a write (capture).
 * Run: HELM_CONVEX_URL=… node test-client.mjs
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const url = process.env.HELM_CONVEX_URL;
if (!url) {
  console.error("set HELM_CONVEX_URL");
  process.exit(1);
}

let failures = 0;
const check = (name, ok, extra = "") => {
  console.log(`${ok ? "  ✅" : "  ❌"} ${name}${extra ? " — " + extra : ""}`);
  if (!ok) failures++;
};

const transport = new StdioClientTransport({
  command: "node",
  args: ["helm-mcp.mjs"],
  env: { ...process.env, HELM_CONVEX_URL: url },
});
const client = new Client({ name: "helm-test", version: "0.0.0" });
await client.connect(transport);

const { tools } = await client.listTools();
const names = tools.map((t) => t.name).sort();
console.log("tools:", names.join(", "));
const expected = [
  "advanceWatermark", "brief", "capture", "chooseToday", "confirmProposed",
  "dayLog", "defer", "get", "getCheckin", "getWatermark", "inbox", "list",
  "listAreas", "logCompletion", "markDone", "reconcileDay", "reconcileOutstanding",
  "setStatus", "snooze", "todaysPick", "update", "waiting", "wake",
];
check(`${expected.length} tools registered`, expected.every((e) => names.includes(e)), names.length + " present");

const brief = await client.callTool({ name: "brief", arguments: {} });
const briefData = JSON.parse(brief.content[0].text);
check("brief returns a London date", /^\d{4}-\d{2}-\d{2}$/.test(briefData.date), briefData.date);
check("brief has counts", typeof briefData.counts?.today === "number");

const cap = await client.callTool({
  name: "capture",
  arguments: { title: "MCP smoke-test capture", areaKey: "personal", dedupeKey: "mcp:smoke" },
});
const capData = JSON.parse(cap.content[0].text);
check("capture via MCP works", typeof capData.taskId === "string", "taskId " + capData.taskId);

const cap2 = await client.callTool({
  name: "capture",
  arguments: { title: "MCP smoke-test capture again", dedupeKey: "mcp:smoke" },
});
check("capture dedupe via MCP", JSON.parse(cap2.content[0].text).created === false);

const list = await client.callTool({ name: "list", arguments: { areaKey: "personal" } });
check("list via MCP returns array", Array.isArray(JSON.parse(list.content[0].text)));

const bad = await client.callTool({ name: "get", arguments: { id: "not-a-real-id" } });
check("invalid id surfaces an error (not a crash)", bad.isError === true);

await client.close();
console.log(failures === 0 ? "\nALL MCP TESTS PASSED" : `\n${failures} MCP TEST(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
