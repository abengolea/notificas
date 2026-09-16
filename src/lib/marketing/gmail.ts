import { decryptSecret, encryptSecret, hmacSha256Hex } from "@/lib/public-api/crypto";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { MARKETING_GMAIL_DOC, MARKETING_SENDS, MARKETING_SETTINGS } from "./collections";
import { recordMarketingEvent } from "./events";
import { marketingGmailEmail } from "./types";
import { appBaseUrl } from "./tokens";
import { matchReplyToSends, type GmailHeaderSet } from "./reply-match";

const GMAIL_SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"].join(" ");

export function gmailOAuthConfigured(): boolean {
  return Boolean(
    (process.env.GOOGLE_MARKETING_OAUTH_CLIENT_ID || "").trim() &&
      (process.env.GOOGLE_MARKETING_OAUTH_CLIENT_SECRET || "").trim(),
  );
}

export function gmailRedirectUri(): string {
  const explicit = (process.env.GOOGLE_MARKETING_OAUTH_REDIRECT_URI || "").trim();
  if (explicit) return explicit;
  return `${appBaseUrl()}/api/admin/marketing/gmail/callback`;
}

export function gmailConnectUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: (process.env.GOOGLE_MARKETING_OAUTH_CLIENT_ID || "").trim(),
    redirect_uri: gmailRedirectUri(),
    response_type: "code",
    scope: GMAIL_SCOPES,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    login_hint: marketingGmailEmail(),
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export function signGmailState(): string {
  const ts = String(Date.now());
  return `${ts}.${hmacSha256Hex(stateSecret(), ts)}`;
}

export function verifyGmailState(state: string): boolean {
  const [ts, sig] = state.split(".");
  if (!ts || !sig) return false;
  const age = Date.now() - Number(ts);
  if (!Number.isFinite(age) || age < 0 || age > 15 * 60 * 1000) return false;
  return hmacSha256Hex(stateSecret(), ts) === sig;
}

function stateSecret(): string {
  return (
    process.env.GOOGLE_MARKETING_OAUTH_CLIENT_SECRET ||
    process.env.ADMIN_SESSION_SECRET ||
    "marketing-gmail-state"
  );
}

type TokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  error?: string;
  error_description?: string;
};

async function exchangeCode(code: string): Promise<TokenResponse> {
  const body = new URLSearchParams({
    code,
    client_id: (process.env.GOOGLE_MARKETING_OAUTH_CLIENT_ID || "").trim(),
    client_secret: (process.env.GOOGLE_MARKETING_OAUTH_CLIENT_SECRET || "").trim(),
    redirect_uri: gmailRedirectUri(),
    grant_type: "authorization_code",
  });
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  return (await res.json()) as TokenResponse;
}

async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  const body = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: (process.env.GOOGLE_MARKETING_OAUTH_CLIENT_ID || "").trim(),
    client_secret: (process.env.GOOGLE_MARKETING_OAUTH_CLIENT_SECRET || "").trim(),
    grant_type: "refresh_token",
  });
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  return (await res.json()) as TokenResponse;
}

async function gmailGet<T>(accessToken: string, path: string): Promise<T> {
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`gmail_${res.status}:${text.slice(0, 180)}`);
  }
  return (await res.json()) as T;
}

export async function storeGmailTokens(code: string): Promise<{ email: string }> {
  const tokens = await exchangeCode(code);
  if (!tokens.access_token) {
    throw new Error(tokens.error_description || tokens.error || "No se pudo obtener el token de Gmail");
  }
  const profile = await gmailGet<{ emailAddress?: string }>(tokens.access_token, "profile");
  const email = String(profile.emailAddress || "").trim().toLowerCase();
  const expected = marketingGmailEmail();
  if (email !== expected) {
    throw new Error(`Hay que conectar ${expected}, no ${email || "otra cuenta"}.`);
  }
  if (!tokens.refresh_token) {
    throw new Error("Google no devolvió refresh_token. Revocá el acceso de la app y volvé a conectar con consentimiento.");
  }
  const db = getAdminDb();
  await db.collection(MARKETING_SETTINGS).doc(MARKETING_GMAIL_DOC).set({
    email,
    refreshTokenEnc: encryptSecret(tokens.refresh_token),
    accessTokenEnc: encryptSecret(tokens.access_token),
    accessTokenExpiresAt: Date.now() + Math.max(30, Number(tokens.expires_in || 3600) - 60) * 1000,
    connectedAt: FieldValue.serverTimestamp(),
    status: "connected",
    lastError: null,
    lastSyncAt: null,
    historyId: null,
  });
  return { email };
}

export async function disconnectGmail(): Promise<void> {
  const db = getAdminDb();
  await db.collection(MARKETING_SETTINGS).doc(MARKETING_GMAIL_DOC).set(
    {
      status: "disconnected",
      refreshTokenEnc: FieldValue.delete(),
      accessTokenEnc: FieldValue.delete(),
      lastError: null,
      disconnectedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
}

export async function gmailStatus(): Promise<{
  configured: boolean;
  connected: boolean;
  email: string | null;
  lastSyncAt: string | null;
  lastError: string | null;
  redirectUri: string;
}> {
  const configured = gmailOAuthConfigured();
  const db = getAdminDb();
  const snap = await db.collection(MARKETING_SETTINGS).doc(MARKETING_GMAIL_DOC).get();
  const data = snap.data() || {};
  return {
    configured,
    connected: data.status === "connected" && Boolean(data.refreshTokenEnc),
    email: typeof data.email === "string" ? data.email : null,
    lastSyncAt: data.lastSyncAt ? String(data.lastSyncAt) : null,
    lastError: typeof data.lastError === "string" ? data.lastError : null,
    redirectUri: gmailRedirectUri(),
  };
}

async function getAccessToken(): Promise<string> {
  const db = getAdminDb();
  const ref = db.collection(MARKETING_SETTINGS).doc(MARKETING_GMAIL_DOC);
  const snap = await ref.get();
  const data = snap.data();
  if (!data?.refreshTokenEnc) throw new Error("Gmail no está conectado");
  const cachedExp = Number(data.accessTokenExpiresAt || 0);
  if (data.accessTokenEnc && cachedExp > Date.now() + 15_000) {
    return decryptSecret(String(data.accessTokenEnc));
  }
  const refreshed = await refreshAccessToken(decryptSecret(String(data.refreshTokenEnc)));
  if (!refreshed.access_token) {
    await ref.update({ status: "error", lastError: refreshed.error_description || refreshed.error || "refresh_failed" });
    throw new Error("No se pudo renovar el acceso a Gmail");
  }
  await ref.update({
    accessTokenEnc: encryptSecret(refreshed.access_token),
    accessTokenExpiresAt: Date.now() + Math.max(30, Number(refreshed.expires_in || 3600) - 60) * 1000,
    lastError: null,
    status: "connected",
  });
  return refreshed.access_token;
}

type GmailMessageList = { messages?: Array<{ id: string; threadId: string }> };
type GmailMessage = {
  id: string;
  threadId: string;
  snippet?: string;
  payload?: { headers?: Array<{ name: string; value: string }> };
};

function headersOf(msg: GmailMessage): GmailHeaderSet {
  const out: GmailHeaderSet = {};
  for (const h of msg.payload?.headers || []) {
    const name = h.name.toLowerCase();
    out[name] = h.value;
  }
  return out;
}

export async function syncGmailReplies(): Promise<{ scanned: number; matched: number }> {
  const db = getAdminDb();
  const access = await getAccessToken();
  const after = Math.floor((Date.now() - 14 * 24 * 60 * 60 * 1000) / 1000);
  const q = encodeURIComponent(`in:inbox after:${after}`);
  const list = await gmailGet<GmailMessageList>(access, `messages?maxResults=40&q=${q}`);
  const messages = list.messages || [];
  let matched = 0;
  const sendsSnap = await db
    .collection(MARKETING_SENDS)
    .where("status", "in", ["sent", "opened", "clicked"])
    .limit(400)
    .get();
  const sends = sendsSnap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      email: String(data.email || ""),
      rfcMessageId: data.rfcMessageId ? String(data.rfcMessageId) : null,
      subject: String(data.subject || ""),
      campaignId: String(data.campaignId || ""),
      contactId: String(data.contactId || ""),
    };
  });

  for (const item of messages) {
    const msg = await gmailGet<GmailMessage>(access, `messages/${item.id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=In-Reply-To&metadataHeaders=References&metadataHeaders=Message-ID`);
    const headers = headersOf(msg);
    const hit = matchReplyToSends({
      headers,
      snippet: msg.snippet || "",
      sends,
    });
    if (!hit) continue;
    await recordMarketingEvent({
      sendId: hit.sendId,
      campaignId: hit.campaignId,
      contactId: hit.contactId,
      type: "replied",
      meta: {
        gmailMessageId: msg.id,
        gmailThreadId: msg.threadId,
        snippet: msg.snippet || "",
        from: headers.from || "",
      },
    });
    matched += 1;
  }

  await db.collection(MARKETING_SETTINGS).doc(MARKETING_GMAIL_DOC).set(
    {
      lastSyncAt: new Date().toISOString(),
      lastError: null,
    },
    { merge: true },
  );

  return { scanned: messages.length, matched };
}
