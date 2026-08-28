import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { randomSecret, sha256Hex } from "@/lib/public-api/crypto";
import { MCP_COLLECTIONS } from "@/mcp/collections";
import { inferMcpClientFromName } from "@/mcp/auth/client-name";

const MAX_REDIRECTS = 10;
const MAX_URI = 2048;

export type OauthClientRecord = {
  id: string;
  clientName: string;
  redirectUris: string[];
  grantTypes: string[];
  responseTypes: string[];
  tokenEndpointAuthMethod: "none";
  clientUri?: string;
  inferredClient: string;
  createdAtMs: number;
};

export function isLoopbackHttp(url: URL): boolean {
  return (
    url.protocol === "http:" &&
    (url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]" || url.hostname === "::1")
  );
}

export function isAllowedRedirectUri(raw: string): boolean {
  if (!raw || raw.length > MAX_URI) return false;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.username || url.password) return false;
  if (url.protocol === "https:") return true;
  return isLoopbackHttp(url);
}

export function validateRedirectUris(uris: unknown): string[] {
  if (!Array.isArray(uris) || uris.length < 1 || uris.length > MAX_REDIRECTS) {
    throw new Error("invalid_redirect_uris");
  }
  const out: string[] = [];
  for (const u of uris) {
    if (typeof u !== "string" || !isAllowedRedirectUri(u)) throw new Error("invalid_redirect_uri");
    if (!out.includes(u)) out.push(u);
  }
  return out;
}

export async function registerOauthClient(input: {
  clientName?: string;
  redirectUris: unknown;
  clientUri?: string;
}): Promise<OauthClientRecord> {
  const redirectUris = validateRedirectUris(input.redirectUris);
  const clientName = (input.clientName || "MCP client").trim().slice(0, 120) || "MCP client";
  const id = `mcp_${randomSecret(18)}`;
  const rec: OauthClientRecord = {
    id,
    clientName,
    redirectUris,
    grantTypes: ["authorization_code", "refresh_token"],
    responseTypes: ["code"],
    tokenEndpointAuthMethod: "none",
    clientUri: typeof input.clientUri === "string" ? input.clientUri.trim().slice(0, 2048) : undefined,
    inferredClient: inferMcpClientFromName(clientName),
    createdAtMs: Date.now(),
  };
  await getAdminDb()
    .collection(MCP_COLLECTIONS.oauthClients)
    .doc(id)
    .set({
      ...rec,
      clientIdHash: sha256Hex(id),
      createdAt: FieldValue.serverTimestamp(),
    });
  return rec;
}

export async function getOauthClient(clientId: string): Promise<OauthClientRecord | null> {
  if (!clientId || clientId.length > 200) return null;
  const snap = await getAdminDb().collection(MCP_COLLECTIONS.oauthClients).doc(clientId).get();
  if (!snap.exists) return null;
  const d = snap.data()!;
  return {
    id: snap.id,
    clientName: String(d.clientName || ""),
    redirectUris: Array.isArray(d.redirectUris) ? d.redirectUris.map(String) : [],
    grantTypes: Array.isArray(d.grantTypes) ? d.grantTypes.map(String) : [],
    responseTypes: Array.isArray(d.responseTypes) ? d.responseTypes.map(String) : [],
    tokenEndpointAuthMethod: "none",
    clientUri: typeof d.clientUri === "string" ? d.clientUri : undefined,
    inferredClient: String(d.inferredClient || inferMcpClientFromName(String(d.clientName || ""))),
    createdAtMs: typeof d.createdAtMs === "number" ? d.createdAtMs : 0,
  };
}

export function clientAllowsRedirect(client: OauthClientRecord, redirectUri: string): boolean {
  return client.redirectUris.includes(redirectUri);
}
