import { createHash } from "node:crypto";
import type { MetaVerifyStatus } from "@/lib/meta-verify-status";

export const META_GRAPH_HOST = "graph.facebook.com";
export const META_GRAPH_VERSION = "v18.0";
export const META_GRAPH_TIMEOUT_MS = 8_000;

const NUMERIC_ID = /^[0-9]{5,32}$/;
const SAFE_FIELDS = /^[a-z0-9_,.{}]{1,240}$/i;
const SAFE_EDGE = /^(phone_numbers)$/;

export type MetaGraphHttpResult = {
  ok: boolean;
  status: number;
  durationMs: number;
  json: Record<string, unknown> | null;
  bodyHash: string;
  error?: string;
  timedOut?: boolean;
};

export type MetaGraphFetcher = (
  objectId: string,
  fields: string,
  edge?: string
) => Promise<MetaGraphHttpResult>;

export function isSafeMetaObjectId(id: string): boolean {
  return NUMERIC_ID.test(id.trim());
}

function assertSafePathParts(objectId: string, fields: string): void {
  if (!isSafeMetaObjectId(objectId)) {
    throw new Error("Identificador Meta no permitido");
  }
  if (fields && !SAFE_FIELDS.test(fields)) {
    throw new Error("Campos Graph no permitidos");
  }
}

export function metaGraphUrl(objectId: string, fields: string, edge?: string): URL {
  assertSafePathParts(objectId, fields);
  if (edge && !SAFE_EDGE.test(edge)) {
    throw new Error("Edge Graph no permitido");
  }
  const path = edge ? `${objectId.trim()}/${edge}` : objectId.trim();
  const url = new URL(`https://${META_GRAPH_HOST}/${META_GRAPH_VERSION}/${path}`);
  if (fields) url.searchParams.set("fields", fields);
  if (edge === "phone_numbers") url.searchParams.set("limit", "100");
  return url;
}

export function asMetaId(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

/** Comparación secundaria del número comercial visible. No valida el Phone Number ID. */
export function normalizeDisplayPhoneNumber(value: string | null | undefined): string {
  return String(value || "").replace(/\D/g, "");
}

export function metaGraphErrorCode(json: Record<string, unknown> | null | undefined): number | null {
  const err = json?.error;
  if (!err || typeof err !== "object" || Array.isArray(err)) return null;
  const code = (err as { code?: unknown }).code;
  return typeof code === "number" ? code : null;
}

export function metaGraphErrorMessage(json: Record<string, unknown> | null | undefined): string | null {
  const err = json?.error;
  if (!err || typeof err !== "object" || Array.isArray(err)) return null;
  const message = (err as { message?: unknown }).message;
  return typeof message === "string" && message.trim() ? message.trim() : null;
}

/**
 * Timeout, 5xx, rate-limit y falta de permisos/credencial: no se puede afirmar que el ID sea incorrecto.
 */
export function isMetaGraphUnavailable(result: Pick<MetaGraphHttpResult, "ok" | "status" | "timedOut" | "json">): boolean {
  if (result.ok) return false;
  if (result.timedOut || result.status === 0 || result.status >= 500 || result.status === 429) return true;
  if (result.status === 401 || result.status === 403) return true;
  const code = metaGraphErrorCode(result.json);
  return code === 2 || code === 4 || code === 10 || code === 17 || code === 104 || code === 190 || code === 200 || code === 613;
}

export function sha256Utf8(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function createMetaGraphFetcher(opts: {
  accessToken: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}): MetaGraphFetcher {
  const token = opts.accessToken.trim();
  const fetchImpl = opts.fetchImpl ?? fetch;
  const timeoutMs = opts.timeoutMs ?? META_GRAPH_TIMEOUT_MS;

  return async (objectId, fields, edge) => {
    const url = metaGraphUrl(objectId, fields, edge);
    const started = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetchImpl(url.toString(), {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
        redirect: "error",
      });
      const text = await res.text();
      let json: Record<string, unknown> | null = null;
      try {
        const parsed = text ? JSON.parse(text) : null;
        json = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
      } catch {
        json = null;
      }
      return {
        ok: res.ok,
        status: res.status,
        durationMs: Date.now() - started,
        json,
        bodyHash: sha256Utf8(text),
        error: res.ok ? undefined : String((json?.error as { message?: string } | undefined)?.message || res.statusText),
      };
    } catch (e) {
      const timedOut = e instanceof Error && (e.name === "AbortError" || /timeout|aborted/i.test(e.message));
      return {
        ok: false,
        status: 0,
        durationMs: Date.now() - started,
        json: null,
        bodyHash: sha256Utf8(""),
        error: timedOut ? "timeout" : e instanceof Error ? e.message : "graph_error",
        timedOut,
      };
    } finally {
      clearTimeout(timer);
    }
  };
}

export type LiveMetaCheck<T> = {
  status: MetaVerifyStatus;
  source: "meta_graph_live";
  queriedAt: string;
  cached: boolean;
  httpStatus: number | null;
  data: T | null;
  message: string;
};

export function pickWabaPublic(json: Record<string, unknown> | null) {
  if (!json) return null;
  return {
    id: typeof json.id === "string" ? json.id : null,
    name: typeof json.name === "string" ? json.name : null,
    timezoneId: typeof json.timezone_id === "string" ? json.timezone_id : null,
    accountReviewStatus:
      typeof json.account_review_status === "string" ? json.account_review_status : null,
  };
}

export function pickPhonePublic(json: Record<string, unknown> | null) {
  if (!json) return null;
  const waba = json.whatsapp_business_account;
  const nestedWabaId =
    waba && typeof waba === "object" && !Array.isArray(waba)
      ? asMetaId((waba as { id?: unknown }).id)
      : null;
  return {
    id: asMetaId(json.id),
    displayPhoneNumber: typeof json.display_phone_number === "string" ? json.display_phone_number : null,
    verifiedName: typeof json.verified_name === "string" ? json.verified_name : null,
    qualityRating: typeof json.quality_rating === "string" ? json.quality_rating : null,
    wabaId: nestedWabaId,
  };
}

export function pickWabaPhoneNumbers(json: Record<string, unknown> | null) {
  const data = json?.data;
  if (!Array.isArray(data)) return [];
  const out: NonNullable<ReturnType<typeof pickPhonePublic>>[] = [];
  for (const item of data) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const picked = pickPhonePublic(item as Record<string, unknown>);
    if (picked?.id) out.push(picked);
  }
  return out;
}

export function pickTemplatePublic(json: Record<string, unknown> | null) {
  if (!json) return null;
  return {
    id: typeof json.id === "string" ? json.id : null,
    name: typeof json.name === "string" ? json.name : null,
    language: typeof json.language === "string" ? json.language : null,
    status: typeof json.status === "string" ? json.status : null,
    category: typeof json.category === "string" ? json.category : null,
  };
}

const SECRET_KEY = /token|secret|authorization|password|cookie|bearer|app_secret|access_token/i;

export function payloadContainsSecrets(value: unknown, depth = 0): boolean {
  if (depth > 8 || value == null) return false;
  if (typeof value === "string") {
    return /EAA[A-Za-z0-9]+/.test(value) || /app_secret|access_token/i.test(value);
  }
  if (Array.isArray(value)) return value.some((v) => payloadContainsSecrets(v, depth + 1));
  if (typeof value === "object") {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SECRET_KEY.test(k)) return true;
      if (payloadContainsSecrets(v, depth + 1)) return true;
    }
  }
  return false;
}
