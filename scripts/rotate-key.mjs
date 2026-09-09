#!/usr/bin/env node
import { createInterface } from "node:readline/promises";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { development } from "./lib/dev.mjs";
import { mintKey, setSecret } from "./lib/keys.mjs";

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help")) { console.log("Usage: npm run rotate-key -- [--yes] [--dry-run]\nRotate the API key and surface token on the configured development deployment."); return; }
  if (args.some(a => !["--yes", "--dry-run"].includes(a))) throw new Error("Use --yes, --dry-run, or --help.");
  const dev = development();
  console.log(`Development deployment: ${dev.name}`);
  console.log("Replace HELM_API_KEY and HELM_SURFACE_TOKEN with separate 48-character random values.");
  console.log("Update these clients after rotation: Helm MCP registration; session-hook environment; the glass browser key; HTTP widgets and ingest integrations.");
  if (args.includes("--dry-run")) { console.log("Dry run. No secrets were changed."); return; }
  if (!args.includes("--yes")) {
    if (!process.stdin.isTTY) throw new Error("Use --yes to approve rotation in a non-interactive run.");
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    let answer; try { answer = await rl.question("Rotate both development credentials? [y/N] "); } finally { rl.close(); }
    if (!/^y(es)?$/i.test(answer.trim())) { console.log("No secrets were changed."); return; }
  }
  const old = Object.fromEntries(["HELM_API_KEY", "HELM_SURFACE_TOKEN"].map(name => [name, dev.cli(["env", "get", name])]));
  const next = { HELM_API_KEY: mintKey(), HELM_SURFACE_TOKEN: mintKey() };
  try {
    for (const [name, value] of Object.entries(next)) setSecret(dev, name, value);
    const client = new ConvexHttpClient(dev.url, { logger: false });
    await client.query(makeFunctionReference("settings:get"), { apiKey: next.HELM_API_KEY });
    const response = await fetch(dev.url.replace(".convex.cloud", ".convex.site") + "/brief", { headers: { "X-Helm-Token": next.HELM_SURFACE_TOKEN } });
    if (!response.ok) throw new Error("Surface verification failed.");
  } catch {
    const failed=[];
    for (const [name, value] of Object.entries(old)) {
      try { if (value) setSecret(dev, name, value); else dev.cli(["env", "remove", name]); } catch { failed.push(name); }
    }
    if (failed.length) throw new Error("Rotation and restoration failed. Check deployment access before reconnecting clients.");
    throw new Error("Rotation failed. The previous credentials were restored.");
  }
  console.log("Rotated and verified both credentials. No secret was printed or written to disk.");
  console.log("Read each new credential locally when you update its clients:");
  console.log("  npx convex env get HELM_API_KEY");
  console.log("  npx convex env get HELM_SURFACE_TOKEN");
  console.log("Run npm run install:claude to refresh the approved Claude configuration. Unlock the glass with the new API key.");
}
main().catch(error => { console.error(error.message.startsWith("Rotation") || error.message.startsWith("Use ") ? error.message : "Rotation failed. Check development access and client configuration."); process.exitCode = 1; });
