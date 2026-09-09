#!/usr/bin/env node
/** Optional SessionEnd backstop. Reads preferences before reading session content.
 * HELM_CONVEX_URL and HELM_API_KEY are required. HELM_HOOK_DISABLED=1 skips it.
 * Every failure is silent. The process has a fixed shutdown deadline. */
import { openSync, readSync, closeSync, fstatSync, constants } from "node:fs";
const deadline = setTimeout(() => process.exit(0), 5000);
deadline.unref();
function readStdin() {
  return new Promise(resolve => {
    let text = "", finished = false;
    const finish = value => { if (finished) return; finished = true; clearTimeout(timer); resolve(value); };
    const timer = setTimeout(() => finish(null), 1000);
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", chunk => { text += chunk; if (text.length > 65536) finish(null); });
    process.stdin.on("end", () => finish(text));
    process.stdin.on("error", () => finish(null));
  });
}
function intent(path, limit) {
  if (typeof path !== "string" || !path || path.length > 4096) return null;
  let fd;
  try {
    // Non-blocking + regular-file check prevents FIFO/device paths from wedging shutdown.
    fd = openSync(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0));
    if (!fstatSync(fd).isFile()) return null;
    const buffer = Buffer.alloc(256 * 1024);
    const length = readSync(fd, buffer, 0, buffer.length, 0);
    for (const line of buffer.toString("utf8", 0, length).split("\n")) {
      let row; try { row = JSON.parse(line); } catch { continue; }
      if (row?.type !== "user") continue;
      const content = row.message?.content ?? row.content;
      const text = typeof content === "string" ? content : Array.isArray(content)
        ? content.filter(block => block?.type === "text" && typeof block.text === "string").map(block => block.text).join(" ") : "";
      const clean = text.trim();
      if (!clean || clean.startsWith("<") || clean.startsWith("/")) continue;
      return Array.from(clean.replace(/\s+/g, " ")).slice(0, limit).join("");
    }
  } catch { /* best effort */ }
  finally { if (fd !== undefined) try { closeSync(fd); } catch { /* best effort */ } }
  return null;
}
async function main() {
  const apiKey = process.env.HELM_API_KEY;
  if (!apiKey || !process.env.HELM_CONVEX_URL || process.env.HELM_HOOK_DISABLED === "1") return;
  const url = new URL(process.env.HELM_CONVEX_URL);
  const cloud = url.protocol === "https:" && url.hostname.endsWith(".convex.cloud");
  const loopback = url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if ((!cloud && !loopback) || url.username || url.password || url.search || url.hash || url.pathname !== "/") return;
  const input = await readStdin(); if (!input) return;
  const payload = JSON.parse(input);
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return;
  const session = payload.session_id ?? payload.sessionId;
  if (typeof session !== "string" || !session.trim() || session.length > 200) return;
  const signal = AbortSignal.timeout(3500);
  async function request(kind, path, args) {
    const response = await fetch(`${url.origin}/api/${kind}`, { method: "POST",
      headers: { "Content-Type": "application/json" }, signal,
      body: JSON.stringify({ path, format: "json", args: { ...args, apiKey } }) });
    if (!response.ok) return null;
    const result = await response.json();
    return result.status === "success" ? result.value : null;
  }
  const settings = await request("query", "settings:get", {});
  const hook = settings?.hook;
  if (hook?.logSessions !== true || !Number.isInteger(hook.titleChars) || hook.titleChars < 1 || hook.titleChars > 500) return;
  const title = intent(payload.transcript_path ?? payload.transcriptPath, hook.titleChars);
  if (!title) return;
  const cwd = payload.cwd ?? payload.workspace;
  const includePath = hook.includeCwd === true && typeof cwd === "string" && cwd.length > 0 && cwd.length <= 4096;
  await request("mutation", "tasks:logCompletion", { title, source: "claude-hook", provisional: true,
    contextLine: includePath ? `Claude Code session in ${cwd}` : "Claude Code session",
    dedupeKey: `session:${session}` });
}
main().catch(() => {}).finally(() => process.exit(0));
