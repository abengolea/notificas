import { randomBytes } from "crypto";
import type { ApiEnvironment } from "@/lib/public-api/types";

const KEY_RE = /^(ntf_(live|test))_([A-Za-z0-9]{16,64})$/;

export function parseApiKey(raw: string): { environment: ApiEnvironment; fullKey: string; prefix: string } | null {
  const token = raw.trim();
  const m = KEY_RE.exec(token);
  if (!m) return null;
  const environment: ApiEnvironment = m[2] === "test" ? "test" : "live";
  const prefix = `${m[1]}_${m[3].slice(0, 4)}`;
  return { environment, fullKey: token, prefix };
}

export function generateApiKeySecret(environment: ApiEnvironment): { fullKey: string; prefix: string } {
  const body = randomBytes(24).toString("base64url").replace(/[^A-Za-z0-9]/g, "x").slice(0, 32);
  const fullKey = `ntf_${environment}_${body}`;
  const parsed = parseApiKey(fullKey);
  if (!parsed) throw new Error("failed_to_generate_api_key");
  return { fullKey, prefix: parsed.prefix };
}
