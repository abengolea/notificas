import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { randomSecret, sha256Hex } from "@/lib/public-api/crypto";
import { MCP_COLLECTIONS } from "@/mcp/collections";
import {
  oauthAccessTokenTtlSeconds,
  oauthAuthCodeTtlSeconds,
  oauthRefreshTokenTtlSeconds,
  mcpResourceUrl,
} from "@/mcp/config";
import type { McpScope } from "@/mcp/scopes";
import { verifyPkceS256 } from "@/mcp/auth/pkce";

export type IssuedTokens = {
  access_token: string;
  refresh_token: string;
  token_type: "Bearer";
  expires_in: number;
  scope: string;
};

export type AccessTokenRecord = {
  userId: string;
  userEmail: string | null;
  orgId: string;
  orgName: string;
  senderUid: string;
  senderEmail: string;
  clientId: string;
  scopes: McpScope[];
  resource: string;
  mcpClient: string;
  expiresAtMs: number;
  revoked: boolean;
};

export async function createAuthorizationCode(input: {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  codeChallengeMethod: "S256";
  resource: string;
  scopes: McpScope[];
  userId: string;
  userEmail: string | null;
  orgId: string;
  orgName: string;
  senderUid: string;
  senderEmail: string;
  mcpClient: string;
}): Promise<string> {
  const code = `ntf_ac_${randomSecret(24)}`;
  const ttl = oauthAuthCodeTtlSeconds();
  await getAdminDb()
    .collection(MCP_COLLECTIONS.oauthAuthCodes)
    .doc(sha256Hex(code))
    .set({
      clientId: input.clientId,
      redirectUri: input.redirectUri,
      codeChallenge: input.codeChallenge,
      codeChallengeMethod: input.codeChallengeMethod,
      resource: input.resource,
      scopes: input.scopes,
      userId: input.userId,
      userEmail: input.userEmail,
      orgId: input.orgId,
      orgName: input.orgName,
      senderUid: input.senderUid,
      senderEmail: input.senderEmail,
      mcpClient: input.mcpClient,
      used: false,
      createdAt: FieldValue.serverTimestamp(),
      expiresAtMs: Date.now() + ttl * 1000,
    });
  return code;
}

export async function consumeAuthorizationCode(opts: {
  code: string;
  clientId: string;
  redirectUri: string;
  codeVerifier: string;
  resource?: string;
}): Promise<AccessTokenRecord> {
  const db = getAdminDb();
  const ref = db.collection(MCP_COLLECTIONS.oauthAuthCodes).doc(sha256Hex(opts.code));
  const record = await db.runTransaction(async (t) => {
    const snap = await t.get(ref);
    if (!snap.exists) throw new Error("invalid_grant");
    const d = snap.data()!;
    if (d.used === true) throw new Error("invalid_grant");
    if (typeof d.expiresAtMs === "number" && d.expiresAtMs < Date.now()) throw new Error("invalid_grant");
    if (String(d.clientId) !== opts.clientId) throw new Error("invalid_grant");
    if (String(d.redirectUri) !== opts.redirectUri) throw new Error("invalid_grant");
    if (!verifyPkceS256(opts.codeVerifier, String(d.codeChallenge || ""))) throw new Error("invalid_grant");
    const expectedResource = String(d.resource || mcpResourceUrl());
    if (opts.resource && opts.resource !== expectedResource) throw new Error("invalid_target");
    t.update(ref, { used: true, usedAt: FieldValue.serverTimestamp() });
    return {
      userId: String(d.userId),
      userEmail: typeof d.userEmail === "string" ? d.userEmail : null,
      orgId: String(d.orgId),
      orgName: String(d.orgName || ""),
      senderUid: String(d.senderUid),
      senderEmail: String(d.senderEmail || ""),
      clientId: String(d.clientId),
      scopes: Array.isArray(d.scopes) ? (d.scopes as McpScope[]) : [],
      resource: expectedResource,
      mcpClient: String(d.mcpClient || "unknown"),
      expiresAtMs: 0,
      revoked: false,
    } satisfies AccessTokenRecord;
  });
  return record;
}

export async function issueTokens(record: Omit<AccessTokenRecord, "expiresAtMs" | "revoked">): Promise<IssuedTokens> {
  const access = `ntf_atk_${randomSecret(24)}`;
  const refresh = `ntf_rtk_${randomSecret(24)}`;
  const accessTtl = oauthAccessTokenTtlSeconds();
  const refreshTtl = oauthRefreshTokenTtlSeconds();
  const now = Date.now();
  const db = getAdminDb();
  await db.collection(MCP_COLLECTIONS.oauthAccessTokens).doc(sha256Hex(access)).set({
    ...record,
    tokenType: "access",
    revoked: false,
    createdAt: FieldValue.serverTimestamp(),
    expiresAtMs: now + accessTtl * 1000,
  });
  await db.collection(MCP_COLLECTIONS.oauthRefreshTokens).doc(sha256Hex(refresh)).set({
    ...record,
    tokenType: "refresh",
    revoked: false,
    createdAt: FieldValue.serverTimestamp(),
    expiresAtMs: now + refreshTtl * 1000,
  });
  return {
    access_token: access,
    refresh_token: refresh,
    token_type: "Bearer",
    expires_in: accessTtl,
    scope: record.scopes.join(" "),
  };
}

export async function refreshTokens(refreshToken: string, resource?: string): Promise<IssuedTokens> {
  const db = getAdminDb();
  const ref = db.collection(MCP_COLLECTIONS.oauthRefreshTokens).doc(sha256Hex(refreshToken));
  const snap = await ref.get();
  if (!snap.exists) throw new Error("invalid_grant");
  const d = snap.data()!;
  if (d.revoked === true) throw new Error("invalid_grant");
  if (typeof d.expiresAtMs === "number" && d.expiresAtMs < Date.now()) throw new Error("invalid_grant");
  const expectedResource = String(d.resource || mcpResourceUrl());
  if (resource && resource !== expectedResource) throw new Error("invalid_target");
  await ref.update({ revoked: true, rotatedAt: FieldValue.serverTimestamp() });
  return issueTokens({
    userId: String(d.userId),
    userEmail: typeof d.userEmail === "string" ? d.userEmail : null,
    orgId: String(d.orgId),
    orgName: String(d.orgName || ""),
    senderUid: String(d.senderUid),
    senderEmail: String(d.senderEmail || ""),
    clientId: String(d.clientId),
    scopes: Array.isArray(d.scopes) ? (d.scopes as McpScope[]) : [],
    resource: expectedResource,
    mcpClient: String(d.mcpClient || "unknown"),
  });
}

export async function lookupAccessToken(token: string): Promise<AccessTokenRecord | null> {
  if (!token || !token.startsWith("ntf_atk_")) return null;
  const snap = await getAdminDb().collection(MCP_COLLECTIONS.oauthAccessTokens).doc(sha256Hex(token)).get();
  if (!snap.exists) return null;
  const d = snap.data()!;
  if (d.revoked === true) return null;
  const expiresAtMs = typeof d.expiresAtMs === "number" ? d.expiresAtMs : 0;
  if (expiresAtMs < Date.now()) return null;
  return {
    userId: String(d.userId),
    userEmail: typeof d.userEmail === "string" ? d.userEmail : null,
    orgId: String(d.orgId),
    orgName: String(d.orgName || ""),
    senderUid: String(d.senderUid),
    senderEmail: String(d.senderEmail || ""),
    clientId: String(d.clientId),
    scopes: Array.isArray(d.scopes) ? (d.scopes as McpScope[]) : [],
    resource: String(d.resource || mcpResourceUrl()),
    mcpClient: String(d.mcpClient || "unknown"),
    expiresAtMs,
    revoked: false,
  };
}

export async function revokeToken(token: string): Promise<void> {
  if (!token) return;
  const db = getAdminDb();
  const hash = sha256Hex(token);
  const access = db.collection(MCP_COLLECTIONS.oauthAccessTokens).doc(hash);
  const refresh = db.collection(MCP_COLLECTIONS.oauthRefreshTokens).doc(hash);
  const [a, r] = await Promise.all([access.get(), refresh.get()]);
  const batch = db.batch();
  if (a.exists) batch.update(access, { revoked: true, revokedAt: FieldValue.serverTimestamp() });
  if (r.exists) batch.update(refresh, { revoked: true, revokedAt: FieldValue.serverTimestamp() });
  if (a.exists || r.exists) await batch.commit();
}
