/** Offline guard tests. The only child executable is a scratch npx recorder. */
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, delimiter } from "node:path";
import { development } from "./lib/dev.mjs";

const root = mkdtempSync(join(tmpdir(), "helm-dev-target-"));
const envFile = join(root, ".env.local"), bin = join(root, "bin"), calls = join(root, "calls.jsonl");
const aliases = ["CONVEX_DEPLOYMENT", "CONVEX_DEPLOY_KEY", "CONVEX_DEPLOYMENT_TOKEN", "CONVEX_DEPLOYMENT_KEY", "CONVEX_SELF_HOSTED_URL", "CONVEX_SELF_HOSTED_ADMIN_KEY"];
const saved = Object.fromEntries(aliases.map(key => [key, process.env[key]]));
const valid = "CONVEX_DEPLOYMENT=dev:offline-development\nCONVEX_URL=https://offline-development.convex.cloud\n";
let count = 0;
const reject = (text) => { writeFileSync(envFile, text); assert.throws(() => development(root)); count++; };
try {
  mkdirSync(bin);
  writeFileSync(join(bin, "npx"), `#!/usr/bin/env node\nconst fs=require("node:fs");const args=process.argv.slice(2);fs.appendFileSync(${JSON.stringify(calls)},JSON.stringify(args)+"\\n");process.stdout.write(JSON.stringify({args,aliases:${JSON.stringify(aliases)}.filter(key=>Object.hasOwn(process.env,key))}));\n`, { mode: 0o700 });
  for (const key of aliases) process.env[key] = "offline-inherited-selector";
  for (const text of [valid,
    'export CONVEX_DEPLOYMENT="dev:offline-development"\nCONVEX_URL="https://offline-development.convex.cloud"\n',
    'CONVEX_DEPLOYMENT: dev:offline-development\nCONVEX_URL: https://offline-development.convex.cloud\n',
    'CONVEX_DEPLOYMENT=prod:ignored-first\n'+valid]) {
    writeFileSync(envFile, text);
    const dev = development(root); dev.env.PATH = bin + delimiter + process.env.PATH;
    assert.equal(dev.name, "offline-development");
    const result = JSON.parse(dev.cli(["function-spec"]));
    assert.deepEqual(result.args, ["--no-install", "convex", "function-spec", "--env-file", envFile]);
    assert.deepEqual(result.aliases, []); count++;
  }
  for (const name of aliases.slice(1)) {
    reject(valid + name + "=\n");
    reject(valid + 'export ' + name + '="offline-credential"\n');
    reject(valid + name + ': offline-credential\n');
  }
  for (const tail of ['CONVEX_DEPLOYMENT=prod:offline-production\n',
    'export CONVEX_DEPLOYMENT="prod:offline-production"\n',
    'CONVEX_DEPLOYMENT: prod:offline-production\n',
    'CONVEX_URL=https://other.convex.cloud\n',
    'CONVEX_DEPLOYMENT=\nCONVEX_SELF_HOSTED_URL=http://127.0.0.1:9999\nCONVEX_SELF_HOSTED_ADMIN_KEY=offline\n']) reject(valid + tail);
  for (const tail of ['CONVEX_DEPLOYMENT=dev:other\nCONVEX_URL=https://other.convex.cloud\n',
    'CONVEX_DEPLOYMENT_TOKEN=offline\n', 'CONVEX_URL=https://other.convex.cloud\n']) {
    writeFileSync(envFile, valid); const dev = development(root); dev.env.PATH = bin + delimiter + process.env.PATH;
    const before = readFileSync(calls, "utf8"); writeFileSync(envFile, valid + tail);
    assert.throws(() => dev.cli(["env", "set", "HELM_ALLOW_ANON", "1"]));
    assert.equal(readFileSync(calls, "utf8"), before); count++;
  }
  writeFileSync(envFile, valid); const dev = development(root); dev.env.PATH = bin + delimiter + process.env.PATH;
  for (const flag of ["env-file", "url", "admin-key", "prod", "deployment", "deployment-name", "preview-name", "team", "project"]) {
    for (const value of ['--'+flag, '--'+flag+'=offline']) {
      assert.throws(() => dev.cli(["run", "testing:offline", value])); count++;
    }
  }
  for (const operation of [["deploy"], ["dev"], ["env", "list"]]) { assert.throws(() => dev.cli(operation)); count++; }
  assert.deepEqual(JSON.parse(dev.cli(["run", "testing:offline", "{}"])) .args,
    ["--no-install", "convex", "run", "testing:offline", "{}", "--env-file", envFile]); count++;
  console.log(`Development target fixtures passed: ${count} parser, alias, target-change, and argument cases; no network calls.`);
} finally {
  for (const [key, value] of Object.entries(saved)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  rmSync(root, { recursive: true, force: true });
}
