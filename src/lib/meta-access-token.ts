import { createSign } from "node:crypto";

const PROJECT_ID =
  process.env.GOOGLE_CLOUD_PROJECT ||
  process.env.GCLOUD_PROJECT ||
  process.env.FIREBASE_PROJECT_ID ||
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
  "notificas-f9953";

const CACHE_MS = 5 * 60 * 1000;
const cache = new Map<string, { value: string; until: number }>();

function fromEnv(name: string): string {
  return (process.env[name] || "").trim();
}

function b64url(input: string | Buffer): string {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input, "utf8");
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function metadataAccessToken(): Promise<string | null> {
  try {
    const res = await fetch(
      "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token",
      {
        headers: { "Metadata-Flavor": "Google" },
        signal: AbortSignal.timeout(1500),
      }
    );
    if (!res.ok) return null;
    const json = (await res.json()) as { access_token?: string };
    return typeof json.access_token === "string" ? json.access_token : null;
  } catch {
    return null;
  }
}

async function serviceAccountAccessToken(): Promise<string | null> {
  const email = (process.env.FIREBASE_CLIENT_EMAIL || "").trim();
  const key = (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n").trim();
  if (!email || !key) return null;
  try {
    const now = Math.floor(Date.now() / 1000);
    const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
    const claim = b64url(
      JSON.stringify({
        iss: email,
        scope: "https://www.googleapis.com/auth/cloud-platform",
        aud: "https://oauth2.googleapis.com/token",
        iat: now,
        exp: now + 3600,
      })
    );
    const unsigned = `${header}.${claim}`;
    const sig = createSign("RSA-SHA256").update(unsigned).sign(key);
    const assertion = `${unsigned}.${b64url(sig)}`;
    const body = new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    });
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { access_token?: string };
    return typeof json.access_token === "string" ? json.access_token : null;
  } catch {
    return null;
  }
}

async function accessSecret(secretName: string, bearer: string): Promise<string | null> {
  const url = `https://secretmanager.googleapis.com/v1/projects/${PROJECT_ID}/secrets/${encodeURIComponent(secretName)}/versions/latest:access`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${bearer}` },
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) {
    console.warn(`Secret Manager ${secretName} HTTP ${res.status}`);
    return null;
  }
  const json = (await res.json()) as { payload?: { data?: string } };
  const b64 = json.payload?.data;
  if (!b64) return null;
  return Buffer.from(b64, "base64").toString("utf8").trim() || null;
}

/** Lee un secreto de env o Secret Manager. Nunca loguear el valor. */
export async function getServerSecret(secretName: string): Promise<string | null> {
  const env = fromEnv(secretName);
  if (env) return env;
  const hit = cache.get(secretName);
  if (hit && Date.now() < hit.until) return hit.value;

  const bearer = (await metadataAccessToken()) || (await serviceAccountAccessToken());
  if (!bearer) return null;
  const secret = await accessSecret(secretName, bearer);
  if (!secret) return null;
  cache.set(secretName, { value: secret, until: Date.now() + CACHE_MS });
  return secret;
}

export async function getWhatsAppAccessToken(): Promise<string | null> {
  return getServerSecret("WHATSAPP_ACCESS_TOKEN");
}

export async function getWhatsAppAppSecret(): Promise<string | null> {
  return getServerSecret("WHATSAPP_APP_SECRET");
}
