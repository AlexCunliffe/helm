import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { parse } from "dotenv";
export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

const CREDENTIAL_SELECTORS = ["CONVEX_DEPLOY_KEY", "CONVEX_DEPLOYMENT_TOKEN", "CONVEX_DEPLOYMENT_KEY", "CONVEX_SELF_HOSTED_URL", "CONVEX_SELF_HOSTED_ADMIN_KEY"];
const TARGET_OPTION = /^--(?:env-file|url|admin-key|prod|deployment|deployment-name|preview-name|team|project)(?:=|$)/;

function readTarget(envFile) {
  // Match the pinned CLI's dotenv semantics, including quotes, exports and duplicates.
  const config = parse(readFileSync(envFile, "utf8"));
  if (CREDENTIAL_SELECTORS.some(key => Object.hasOwn(config, key)))
    throw new Error("Use account authentication for development. Remove deployment credentials and self-hosted selectors from .env.local.");
  const name = config.CONVEX_DEPLOYMENT?.match(/^dev:([a-z0-9-]+)$/)?.[1];
  if (!name) throw new Error("Use a dev deployment in .env.local.");
  let parsed;
  try { parsed = new URL(config.CONVEX_URL); } catch { throw new Error("Use the matching development CONVEX_URL in .env.local."); }
  if (parsed.protocol !== "https:" || !parsed.hostname.startsWith(name + ".") ||
      !parsed.hostname.endsWith(".convex.cloud") || parsed.username || parsed.password ||
      parsed.port || parsed.search || parsed.hash || parsed.pathname !== "/")
    throw new Error("CONVEX_URL must match the dev deployment in .env.local.");
  return { name, url: config.CONVEX_URL };
}

/** Local tools deliberately target cloud development using account authentication. */
export function development(root = ROOT) {
  const envFile = resolve(root, ".env.local"), target = readTarget(envFile);
  const env = { ...process.env };
  for (const key of ["CONVEX_DEPLOYMENT", ...CREDENTIAL_SELECTORS]) delete env[key];
  function assertTarget() {
    const current = readTarget(envFile);
    if (current.name !== target.name || current.url !== target.url)
      throw new Error("Use the original development target or restart the command. The target changed after the initial check.");
  }
  function cliArgs(args) {
    if (!(args[0] === "run" || args[0] === "function-spec" ||
        args[0] === "env" && ["get", "set", "remove"].includes(args[1])) || args.some(arg => TARGET_OPTION.test(arg)))
      throw new Error("Use only development run, environment, or metadata commands without target overrides.");
    assertTarget(); // Recheck the exact file immediately before each administration call.
    return ["--no-install", "convex", ...args, "--env-file", envFile];
  }
  function cli(args, { input } = {}) {
    const bounded = cliArgs(args);
    try { return execFileSync("npx", bounded,
      { cwd: root, env, encoding: "utf8", input, stdio: ["pipe", "pipe", "pipe"], maxBuffer: 8 * 1024 * 1024 }).trim(); }
    catch { throw new Error(`Development CLI command failed: ${args[0]} ${args[1] ?? ""}. Check deployment access.`); }
  }
  const getKey = () => { const key = cli(["env", "get", "HELM_API_KEY"]); if (!key) throw new Error("Set a development API key first."); return key; };
  return { root, envFile, ...target, env, cli, cliArgs, assertTarget, getKey };
}
