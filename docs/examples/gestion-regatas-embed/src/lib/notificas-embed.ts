import { SignJWT, jwtVerify } from "jose";

const COOKIE_NAME = "notificas_embed";
const COOKIE_MAX_AGE = 30 * 60;

function embedSecret() {
  const raw =
    process.env.NOTIFICAS_EMBED_SECRET?.trim() ||
    process.env.QR_JWT_SECRET?.trim() ||
    "dev-notificas-embed";
  return new TextEncoder().encode(raw);
}

export function notificasApiConfigured(): boolean {
  return Boolean(process.env.NOTIFICAS_API_KEY?.trim());
}

export function notificasApiBase(): string {
  return (process.env.NOTIFICAS_API_BASE?.trim() || "https://notificas.com.ar/api/v1").replace(
    /\/$/,
    ""
  );
}

export async function signNotificasEmbedSession(uid: string): Promise<string> {
  return new SignJWT({ uid, scope: "notificas_embed" })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(`${COOKIE_MAX_AGE}s`)
    .sign(embedSecret());
}

export async function verifyNotificasEmbedSession(
  token: string | undefined
): Promise<{ uid: string } | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, embedSecret());
    if (payload.scope !== "notificas_embed" || typeof payload.uid !== "string") return null;
    return { uid: payload.uid };
  } catch {
    return null;
  }
}

export const notificasEmbedCookie = {
  name: COOKIE_NAME,
  maxAge: COOKIE_MAX_AGE,
} as const;
