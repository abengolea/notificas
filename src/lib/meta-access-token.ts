const PROJECT_ID =
  process.env.GOOGLE_CLOUD_PROJECT ||
  process.env.GCLOUD_PROJECT ||
  process.env.FIREBASE_PROJECT_ID ||
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
  "notificas-f9953";

const SECRET_NAME = "WHATSAPP_ACCESS_TOKEN";
const CACHE_MS = 5 * 60 * 1000;

let cached: { value: string; until: number } | null = null;

function fromEnv(): string {
  return (process.env.WHATSAPP_ACCESS_TOKEN || "").trim();
}

async function gcpAccessToken(): Promise<string | null> {
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

async function accessSecretWithBearer(bearer: string): Promise<string | null> {
  const url = `https://secretmanager.googleapis.com/v1/projects/${PROJECT_ID}/secrets/${SECRET_NAME}/versions/latest:access`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${bearer}` },
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) {
    console.warn(`WHATSAPP_ACCESS_TOKEN Secret Manager HTTP ${res.status}`);
    return null;
  }
  const json = (await res.json()) as { payload?: { data?: string } };
  const b64 = json.payload?.data;
  if (!b64) return null;
  return Buffer.from(b64, "base64").toString("utf8").trim() || null;
}

/**
 * Token de Graph API solo servidor. Nunca loguear el valor.
 * 1) env (App Hosting / .env)
 * 2) Secret Manager, misma fuente que Cloud Functions.
 */
export async function getWhatsAppAccessToken(): Promise<string | null> {
  const env = fromEnv();
  if (env) return env;
  if (cached && Date.now() < cached.until) return cached.value;

  const bearer = await gcpAccessToken();
  if (!bearer) return null;
  const secret = await accessSecretWithBearer(bearer);
  if (!secret) return null;
  cached = { value: secret, until: Date.now() + CACHE_MS };
  return secret;
}
