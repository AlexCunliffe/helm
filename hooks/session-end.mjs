#!/usr/bin/env node
/**
 * Helm SessionEnd hook (Phase 1).
 *
 * On every Claude Code session end, logs ONE provisional completion to Helm so
 * unplanned / rabbit-hole work isn't lost (docs/01, docs/10). It's a blunt
 * backstop — the intelligent path is the global CLAUDE.md rule, where Claude
 * logs real completions during the session. Marked `provisional:true` and
 * deduped by session id, so the evening reconcile can refine/merge/drop it
 * (docs/08: operational auto-write to Convex is fine; knowledge never is).
 *
 * Zero-dependency: a single fetch to the deployment's public mutation endpoint,
 * so it can't break a session or need an install. It NEVER throws and ALWAYS
 * exits 0 — a hook must never wedge session shutdown.
 *
 * Config (env): HELM_CONVEX_URL (required, the deployment client URL).
 *               HELM_API_KEY (required once the deployment enforces keys — 4.1/D15).
 *               HELM_HOOK_DISABLED=1 to opt out.
 */

function readStdin() {
  return new Promise((resolve) => {
    let data = "";
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      resolve(data);
    };
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (c) => (data += c));
    process.stdin.on("end", finish);
    process.stdin.on("error", finish);
    // Belt-and-braces: if nothing ever pipes in, resolve anyway so shutdown
    // can't hang. The timer fires while stdin keeps the loop alive; unref so it
    // can't itself keep the process up.
    const t = setTimeout(finish, 1500);
    if (typeof t.unref === "function") t.unref();
  });
}

/**
 * Best-effort: the session's opening user message = its intent. The first user
 * message is at the TOP of the transcript, so read only a bounded head — never
 * load a multi-MB (or pathological) transcript fully into memory.
 */
async function deriveIntent(transcriptPath) {
  if (!transcriptPath) return null;
  try {
    const fs = await import("node:fs");
    const HEAD_BYTES = 256 * 1024; // enough to reach the first user turn
    const fd = fs.openSync(transcriptPath, "r");
    let text;
    try {
      const buf = Buffer.alloc(HEAD_BYTES);
      const n = fs.readSync(fd, buf, 0, HEAD_BYTES, 0);
      text = buf.toString("utf8", 0, n);
    } finally {
      fs.closeSync(fd);
    }
    // Drop a trailing partial line so JSON.parse doesn't choke on it.
    const lines = text.split("\n");
    if (!text.endsWith("\n")) lines.pop();
    for (const line of lines) {
      let o;
      try {
        o = JSON.parse(line);
      } catch {
        continue;
      }
      if (o?.type !== "user") continue;
      const content = o.message?.content ?? o.content;
      let s = null;
      if (typeof content === "string") s = content;
      else if (Array.isArray(content)) {
        const block = content.find((b) => b?.type === "text" && typeof b.text === "string");
        s = block?.text ?? null;
      }
      if (s) {
        s = s.trim();
        // skip slash-command / hook-injected noise
        if (s.startsWith("<") || s.startsWith("/")) continue;
        return s.replace(/\s+/g, " ").slice(0, 140);
      }
    }
  } catch {
    /* ignore */
  }
  return null;
}

async function main() {
  const url = process.env.HELM_CONVEX_URL;
  if (!url || process.env.HELM_HOOK_DISABLED) return;

  let payload = {};
  try {
    payload = JSON.parse((await readStdin()) || "{}");
  } catch {
    payload = {};
  }

  const sessionId = payload.session_id ?? payload.sessionId ?? "unknown";
  const cwd = payload.cwd ?? payload.workspace ?? "";
  const intent = await deriveIntent(payload.transcript_path ?? payload.transcriptPath);

  // Nothing to say (empty/trivial session) → don't add noise.
  if (!intent) return;

  const project = cwd ? cwd.split("/").filter(Boolean).pop() : null;
  const body = {
    path: "tasks:logCompletion",
    format: "json",
    args: {
      ...(process.env.HELM_API_KEY ? { apiKey: process.env.HELM_API_KEY } : {}),
      title: intent,
      source: "claude-hook",
      provisional: true,
      contextLine: project
        ? `Claude Code session in ${project} (${cwd})`
        : "Claude Code session",
      dedupeKey: `session:${sessionId}`,
    },
  };

  // Portable timeout (AbortSignal.timeout may be missing on older Node) so a
  // slow/unreachable deployment can never hang session shutdown.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/api/mutation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    // Drain quietly; success or not, we exit 0.
    await res.text().catch(() => {});
  } catch {
    /* network/best-effort: never block shutdown */
  } finally {
    clearTimeout(timer);
  }
}

main().finally(() => process.exit(0));
