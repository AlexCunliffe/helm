#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { development } from "./lib/dev.mjs";
import { AREA_PRESETS, validateAreas } from "./lib/areas.mjs";

export async function seedAreas({ areas = AREA_PRESETS.generic, dryRun = false, dev = development() } = {}) {
  validateAreas(areas);
  const apiKey = dev.getKey();
  const client = new ConvexHttpClient(dev.url, { logger: false });
  const existing = await client.query(makeFunctionReference("areas:listAreas"), { apiKey, includeArchived: true });
  if (existing.length) { console.log("Areas already exist. Keep the current set."); return { inserted: 0, updated: 0 }; }
  console.log("Seed these areas:");
  for (const a of areas) console.log(`  ${a.key}: ${a.label} (${a.color})`);
  if (dryRun) { console.log("Dry run. No areas were written."); return { inserted: 0, updated: 0 }; }
  const result = await client.mutation(makeFunctionReference("areas:seedAreas"), { apiKey, areas, onlyIfEmpty: true });
  console.log(`Seeded ${result.inserted} areas.`);
  return result;
}
async function main() {
  const args = process.argv.slice(2); let preset = "generic", from, dryRun = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--help") { console.log("Usage: npm run seed -- [--preset generic|classic] [--from areas.json] [--dry-run]\nSeed an empty development deployment. Existing areas stay unchanged."); return; }
    if (args[i] === "--dry-run") dryRun = true;
    else if (args[i] === "--preset" && args[i + 1]) preset = args[++i];
    else if (args[i] === "--from" && args[i + 1]) from = args[++i];
    else throw new Error("Use --preset, --from, --dry-run, or --help.");
  }
  if (!AREA_PRESETS[preset]) throw new Error("Use the generic or classic preset.");
  const areas = from ? JSON.parse(readFileSync(from, "utf8")) : AREA_PRESETS[preset];
  await seedAreas({ areas, dryRun });
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main().catch(() => { console.error("Seed failed. Check the area file, development configuration, and API key."); process.exitCode = 1; });
