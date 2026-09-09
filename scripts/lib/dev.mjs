import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

/** Local tools in this repository deliberately target cloud development only. */
export function development(root = ROOT) {
  const envFile = resolve(root, ".env.local");
  const text = readFileSync(envFile, "utf8");
  const value = key => text.match(new RegExp(`^${key}=([^\\r\\n#]+)`, "m"))?.[1]?.trim();
  const deployment = value("CONVEX_DEPLOYMENT");
  const name = deployment?.match(/^dev:([a-z0-9-]+)$/)?.[1];
  if (!name) throw new Error("Use a dev deployment in .env.local.");
  const url = value("CONVEX_URL");
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" || !parsed.hostname.startsWith(name + ".") ||
      !parsed.hostname.endsWith(".convex.cloud") || parsed.username || parsed.password ||
      parsed.port || parsed.search || parsed.hash || parsed.pathname !== "/")
    throw new Error("CONVEX_URL must match the dev deployment in .env.local.");
  const env = { ...process.env };
  for (const key of ["CONVEX_DEPLOYMENT", "CONVEX_DEPLOY_KEY", "CONVEX_DEPLOYMENT_KEY", "CONVEX_SELF_HOSTED_URL", "CONVEX_SELF_HOSTED_ADMIN_KEY"]) delete env[key];
  function cli(args, { input } = {}) {
    try { return execFileSync("npx", ["--no-install", "convex", ...args, "--env-file", envFile],
      { cwd: root, env, encoding: "utf8", input, stdio: ["pipe", "pipe", "pipe"], maxBuffer: 8 * 1024 * 1024 }).trim(); }
    catch { throw new Error(`Development CLI command failed: ${args[0]} ${args[1] ?? ""}. Check deployment access.`); }
  }
  const getKey = () => { const key = cli(["env", "get", "HELM_API_KEY"]); if (!key) throw new Error("Set a development API key first."); return key; };
  return { root, envFile, url, name, env, cli, getKey };
}
