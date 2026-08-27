import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { hashApiKey, timingSafeEqualText } from "@/lib/public-api/crypto";
import { generateApiKeySecret, parseApiKey } from "@/lib/public-api/api-key-format";
import { forbidden, notFound, unauthorized } from "@/lib/public-api/errors";
import { newApiKeyId } from "@/lib/public-api/ids";
import { DEFAULT_LIVE_SCOPES, type PublicApiScope } from "@/lib/public-api/scopes";
import { COLLECTIONS, type ApiEnvironment, type ApiKeyRecord } from "@/lib/public-api/types";

export { generateApiKeySecret, parseApiKey } from "@/lib/public-api/api-key-format";

export async function createApiKey(params: {
  orgId: string;
  name: string;
  environment: ApiEnvironment;
  scopes?: PublicApiScope[];
  createdBy: string;
}): Promise<{ record: ApiKeyRecord; secret: string }> {
  const db = getAdminDb();
  const id = newApiKeyId();
  const generated = generateApiKeySecret(params.environment);
  const now = FieldValue.serverTimestamp();
  const record: ApiKeyRecord = {
    id,
    orgId: params.orgId,
    name: params.name.trim().slice(0, 80) || "default",
    prefix: generated.prefix,
    keyHash: hashApiKey(generated.fullKey),
    environment: params.environment,
    scopes: params.scopes?.length ? params.scopes : DEFAULT_LIVE_SCOPES,
    status: "active",
    createdAt: now,
    lastUsedAt: null,
    createdBy: params.createdBy,
  };
  await db.collection(COLLECTIONS.apiKeys).doc(id).set(record);
  return { record, secret: generated.fullKey };
}

export async function revokeApiKey(params: { keyId: string; orgId?: string }): Promise<void> {
  const db = getAdminDb();
  const ref = db.collection(COLLECTIONS.apiKeys).doc(params.keyId);
  const snap = await ref.get();
  if (!snap.exists) throw notFound("api_key_not_found", "API key not found.");
  const data = snap.data() as ApiKeyRecord;
  if (params.orgId && data.orgId !== params.orgId) {
    throw forbidden("tenant_mismatch", "This API key does not belong to the requested account.");
  }
  await ref.update({ status: "revoked", revokedAt: FieldValue.serverTimestamp() });
}

export async function listApiKeys(orgId: string): Promise<Array<Omit<ApiKeyRecord, "keyHash">>> {
  const db = getAdminDb();
  const snap = await db.collection(COLLECTIONS.apiKeys).where("orgId", "==", orgId).get();
  return snap.docs
    .map((d) => {
      const data = d.data() as ApiKeyRecord;
      const { keyHash: _omit, ...rest } = data;
      void _omit;
      return { ...rest, id: d.id };
    })
    .sort((a, b) => String(a.prefix).localeCompare(String(b.prefix)));
}

export async function authenticateBearerToken(authorization: string | null): Promise<ApiKeyRecord> {
  const raw = authorization?.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!raw) throw unauthorized();
  const parsed = parseApiKey(raw);
  if (!parsed) throw unauthorized();

  const db = getAdminDb();
  const hash = hashApiKey(parsed.fullKey);
  const snap = await db.collection(COLLECTIONS.apiKeys).where("keyHash", "==", hash).limit(2).get();
  if (snap.empty) throw unauthorized();
  if (snap.size > 1) throw unauthorized("invalid_api_key", "Invalid API key.");

  const data = { id: snap.docs[0].id, ...(snap.docs[0].data() as Omit<ApiKeyRecord, "id">) };
  if (data.status !== "active") throw unauthorized("revoked_api_key", "This API key has been revoked.");
  if (data.environment !== parsed.environment) throw unauthorized();
  if (!timingSafeEqualText(data.keyHash, hash)) throw unauthorized();
  return data;
}

export async function touchApiKeyLastUsed(keyId: string): Promise<void> {
  try {
    await getAdminDb().collection(COLLECTIONS.apiKeys).doc(keyId).update({
      lastUsedAt: FieldValue.serverTimestamp(),
    });
  } catch {
    // no bloquear el request
  }
}

/** Nunca loguear el secret. Solo id/prefix. */
export function redactApiKeyForLogs(key: Pick<ApiKeyRecord, "id" | "prefix" | "orgId">): string {
  return `apiKey=${key.id} prefix=${key.prefix} org=${key.orgId}`;
}
