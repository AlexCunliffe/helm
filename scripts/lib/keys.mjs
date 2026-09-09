import { randomBytes } from "node:crypto";
import { timingSafeEqual } from "node:crypto";
export const mintKey = () => randomBytes(24).toString("hex");
export function setSecret(dev, name, value) {
  if (!["HELM_API_KEY", "HELM_SURFACE_TOKEN", "ANTHROPIC_API_KEY"].includes(name)) throw new Error("Unsupported secret name.");
  if (typeof value !== "string" || !value || value.includes("\n") || value.includes("\r")) throw new Error("Use a non-empty, single-line secret.");
  // Convex reads the value from stdin. It is absent from argv and shell history.
  dev.cli(["env", "set", name], { input: value });
  const stored = dev.cli(["env", "get", name]);
  const a = Buffer.from(value), b = Buffer.from(stored);
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new Error("Secret verification failed.");
}
