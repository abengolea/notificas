import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { randomSecret, sha256Hex } from "@/lib/public-api/crypto";
import { MCP_COLLECTIONS } from "@/mcp/collections";
import { inferMcpClientFromName } from "@/mcp/auth/client-name";

const MAX_REDIRECTS = 10;
const MAX_URI = 2048;
const SUPPORTED_GRANTS = ["authorization_code", "refresh_token"] as const;

export class OauthClientMetadataError extends Error {
  readonly error = "invalid_client_metadata";
  constructor(readonly errorDescription: string) {
    super(errorDescription);
    this.name = "OauthClientMetadataError";
  }
}

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

export type ParsedDcrRegistration = {
  clientName: string;
  redirectUris: string[];
  grantTypes: string[];
  responseTypes: ["code"];
  tokenEndpointAuthMethod: "none";
  clientUri?: string;
};

export function isLoopbackHttp(url: URL): boolean {
  return (
    url.protocol === "http:" &&
    (url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]" || url.hostname === "::1")
  );
}

export function isChatgptRedirectUri(url: URL): boolean {
  if (url.protocol !== "https:") return false;
  const host = url.hostname.toLowerCase();
  if (host !== "chatgpt.com" && host !== "www.chatgpt.com" && host !== "chat.openai.com") return false;
  const path = url.pathname.replace(/\/+$/, "") || "/";
  if (path === "/connector_platform_oauth_redirect") return true;
  return path.startsWith("/connector/oauth/");
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
  if (url.hash) return false;
  if (url.protocol === "https:") return true;
  return isLoopbackHttp(url);
}

export function normalizeRedirectUris(uris: unknown): string[] {
  if (typeof uris === "string") return [uris];
  if (!Array.isArray(uris)) {
    throw new OauthClientMetadataError("redirect_uris must be an array of HTTPS callback URIs.");
  }
  return uris;
}

export function validateRedirectUris(uris: unknown): string[] {
  const list = normalizeRedirectUris(uris);
  if (list.length < 1 || list.length > MAX_REDIRECTS) {
    throw new OauthClientMetadataError("redirect_uris must contain between 1 and 10 URIs.");
  }
  const out: string[] = [];
  for (const u of list) {
    if (typeof u !== "string" || !isAllowedRedirectUri(u)) {
      throw new OauthClientMetadataError("redirect_uris contains a URI that is not HTTPS or loopback HTTP.");
    }
    if (!out.includes(u)) out.push(u);
  }
  return out;
}

function asStringList(value: unknown, field: string): string[] | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "string") return value.split(/[\s,]+/).filter(Boolean);
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new OauthClientMetadataError(`${field} must be an array of strings.`);
  }
  return value;
}

export function parseDcrRegistration(body: Record<string, unknown>): ParsedDcrRegistration {
  const redirectUris = validateRedirectUris(body.redirect_uris);
  const requestedGrants = asStringList(body.grant_types, "grant_types");
  const grantTypes = requestedGrants
    ? SUPPORTED_GRANTS.filter((grant) => requestedGrants.includes(grant))
    : [...SUPPORTED_GRANTS];
  if (!grantTypes.includes("authorization_code")) {
    throw new OauthClientMetadataError("grant_types must include authorization_code.");
  }

  const requestedResponses = asStringList(body.response_types, "response_types");
  if (requestedResponses && !requestedResponses.includes("code")) {
    throw new OauthClientMetadataError("response_types must include code.");
  }

  const clientName =
    (typeof body.client_name === "string" ? body.client_name : "MCP client").trim().slice(0, 120) || "MCP client";
  const clientUriRaw = typeof body.client_uri === "string" ? body.client_uri.trim().slice(0, 2048) : "";

  return {
    clientName,
    redirectUris,
    grantTypes,
    responseTypes: ["code"],
    tokenEndpointAuthMethod: "none",
    clientUri: clientUriRaw || undefined,
  };
}

export function summarizeDcrBody(body: Record<string, unknown>): Record<string, unknown> {
  let redirectHosts: string[] = [];
  try {
    redirectHosts = normalizeRedirectUris(body.redirect_uris).map((raw) => {
      try {
        return new URL(raw).host;
      } catch {
        return "invalid";
      }
    });
  } catch {
    redirectHosts = ["unparsed"];
  }
  return {
    keys: Object.keys(body).filter((key) => !/secret|token|password|assertion|jwks/i.test(key)),
    client_name: typeof body.client_name === "string" ? body.client_name.slice(0, 120) : typeof body.client_name,
    redirect_hosts: redirectHosts,
    grant_types: body.grant_types,
    response_types: body.response_types,
    token_endpoint_auth_method: body.token_endpoint_auth_method,
    application_type: body.application_type,
    scope: typeof body.scope === "string" ? body.scope.slice(0, 200) : typeof body.scope,
  };
}

export function registrationResponse(client: OauthClientRecord): Record<string, unknown> {
  const body: Record<string, unknown> = {
    client_id: client.id,
    client_id_issued_at: Math.floor(client.createdAtMs / 1000),
    client_name: client.clientName,
    redirect_uris: client.redirectUris,
    grant_types: client.grantTypes,
    response_types: client.responseTypes,
    token_endpoint_auth_method: client.tokenEndpointAuthMethod,
  };
  if (client.clientUri) body.client_uri = client.clientUri;
  return body;
}

function omitUndefined(data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) out[key] = value;
  }
  return out;
}

export async function registerOauthClient(input: {
  clientName?: string;
  redirectUris: unknown;
  clientUri?: string;
  grantTypes?: string[];
  responseTypes?: string[];
}): Promise<OauthClientRecord> {
  const parsed = parseDcrRegistration({
    client_name: input.clientName,
    redirect_uris: input.redirectUris,
    client_uri: input.clientUri,
    grant_types: input.grantTypes,
    response_types: input.responseTypes,
  });
  const id = `mcp_${randomSecret(18)}`;
  const rec: OauthClientRecord = {
    id,
    clientName: parsed.clientName,
    redirectUris: parsed.redirectUris,
    grantTypes: parsed.grantTypes,
    responseTypes: parsed.responseTypes,
    tokenEndpointAuthMethod: "none",
    clientUri: parsed.clientUri,
    inferredClient: inferMcpClientFromName(parsed.clientName),
    createdAtMs: Date.now(),
  };
  await getAdminDb()
    .collection(MCP_COLLECTIONS.oauthClients)
    .doc(id)
    .set(
      omitUndefined({
        ...rec,
        clientIdHash: sha256Hex(id),
        createdAt: FieldValue.serverTimestamp(),
      }),
    );
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
