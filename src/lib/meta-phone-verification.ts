import type { MetaLiveIdentity } from "@/lib/meta-communication-types";
import type { MetaVerifyStatus } from "@/lib/meta-verify-status";
import {
  isMetaGraphUnavailable,
  isSafeMetaObjectId,
  metaGraphErrorMessage,
  normalizeDisplayPhoneNumber,
  pickPhonePublic,
  pickWabaPhoneNumbers,
  type MetaGraphFetcher,
  type MetaGraphHttpResult,
} from "@/lib/meta-graph-client";

export const PHONE_LIVE_FIELDS = "id,display_phone_number,verified_name";

export type PhoneVerifySource = "META_GRAPH_API" | "META_WABA_PHONE_NUMBERS";

export type PhoneNumberVerifyResult = {
  status: MetaVerifyStatus;
  phoneNumberId: string;
  metaId: string | null;
  displayPhoneNumber: string | null;
  verifiedName: string | null;
  belongsToWaba: boolean | null;
  wabaId: string | null;
  checkedAt: string;
  source: PhoneVerifySource | null;
  message: string;
  identity: MetaLiveIdentity;
  unavailable: boolean;
};

function publicFieldNames(json: Record<string, unknown> | null): string[] {
  if (!json) return [];
  return Object.keys(json).filter((k) => k !== "error");
}

function logPhoneVerifyDiag(payload: {
  endpoint: string;
  httpStatus: number | null;
  returnedFields: string[];
  metaError: string | null;
  expectedPhoneNumberId: string | null;
  expectedWabaId: string | null;
}) {
  console.info("[meta-phone-verify]", JSON.stringify(payload));
}

function idsEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  if (a == null || b == null || a === "" || b === "") return false;
  return String(a) === String(b);
}

function toIdentity(result: Omit<PhoneNumberVerifyResult, "identity">): MetaLiveIdentity {
  return {
    id: result.phoneNumberId,
    status: result.status,
    message: result.message,
    queriedAt: result.checkedAt,
    cached: false,
    fields: {
      id: result.metaId,
      displayPhoneNumber: result.displayPhoneNumber,
      verifiedName: result.verifiedName,
      wabaId: result.wabaId,
    },
    matchesEvidence: result.status === "VERIFIED",
    belongsToWaba: result.belongsToWaba,
    source: result.source,
  };
}

function wrap(
  partial: Omit<PhoneNumberVerifyResult, "identity" | "checkedAt"> & { checkedAt?: string }
): PhoneNumberVerifyResult {
  const checkedAt = partial.checkedAt || new Date().toISOString();
  const base = { ...partial, checkedAt };
  return { ...base, identity: toIdentity(base) };
}

/**
 * Valida el Phone Number ID del emisor contra Meta.
 * No usa recipient_id ni el teléfono del destinatario.
 */
export async function verifyPhoneNumberAgainstMeta(opts: {
  storedPhoneNumberId: string | null;
  storedWabaId: string | null;
  /** Número comercial interno opcional; comparación secundaria, nunca primaria. */
  storedDisplayPhone?: string | null;
  /** Destinatario: no debe influir el resultado. */
  recipientId?: string | null;
  fetcher: MetaGraphFetcher | null;
  now?: Date;
}): Promise<PhoneNumberVerifyResult> {
  void opts.recipientId;
  const phoneId = opts.storedPhoneNumberId?.trim() || "";
  const wabaId = opts.storedWabaId?.trim() || "";
  const checkedAt = (opts.now || new Date()).toISOString();

  if (!phoneId || !isSafeMetaObjectId(phoneId)) {
    return wrap({
      status: "NOT_AVAILABLE",
      phoneNumberId: phoneId,
      metaId: null,
      displayPhoneNumber: null,
      verifiedName: null,
      belongsToWaba: null,
      wabaId: wabaId || null,
      checkedAt,
      source: null,
      message: "No hay Phone Number ID conservado en la evidencia de este envío.",
      unavailable: false,
    });
  }

  if (!opts.fetcher) {
    return wrap({
      status: "API_UNAVAILABLE",
      phoneNumberId: phoneId,
      metaId: null,
      displayPhoneNumber: null,
      verifiedName: null,
      belongsToWaba: null,
      wabaId: wabaId || null,
      checkedAt,
      source: null,
      message:
        "No fue posible realizar en este momento la comprobación del Phone Number ID contra Meta.",
      unavailable: true,
    });
  }

  const direct = await opts.fetcher(phoneId, PHONE_LIVE_FIELDS);
  logPhoneVerifyDiag({
    endpoint: `GET /${phoneId}?fields=${PHONE_LIVE_FIELDS}`,
    httpStatus: direct.status,
    returnedFields: publicFieldNames(direct.json),
    metaError: metaGraphErrorMessage(direct.json) || direct.error || null,
    expectedPhoneNumberId: phoneId,
    expectedWabaId: wabaId || null,
  });

  const directPicked = pickPhonePublic(direct.json);
  const directIdMatch = idsEqual(directPicked?.id, phoneId);

  let list: MetaGraphHttpResult | null = null;
  let listedMatch: NonNullable<ReturnType<typeof pickPhonePublic>> | null = null;
  let belongsToWaba: boolean | null = null;

  if (wabaId && isSafeMetaObjectId(wabaId)) {
    list = await opts.fetcher(wabaId, PHONE_LIVE_FIELDS, "phone_numbers");
    logPhoneVerifyDiag({
      endpoint: `GET /${wabaId}/phone_numbers?fields=${PHONE_LIVE_FIELDS}`,
      httpStatus: list.status,
      returnedFields: publicFieldNames(list.json),
      metaError: metaGraphErrorMessage(list.json) || list.error || null,
      expectedPhoneNumberId: phoneId,
      expectedWabaId: wabaId,
    });
    if (list.ok) {
      const numbers = pickWabaPhoneNumbers(list.json);
      listedMatch = numbers.find((n) => idsEqual(n.id, phoneId)) || null;
      belongsToWaba = Boolean(listedMatch);
    }
  }

  const picked = directIdMatch ? directPicked : listedMatch;
  const metaId = picked?.id || (directIdMatch ? phoneId : null);
  const displayPhoneNumber = picked?.displayPhoneNumber || null;
  const verifiedName = picked?.verifiedName || null;

  if (directIdMatch) {
    if (opts.storedDisplayPhone && displayPhoneNumber) {
      void (normalizeDisplayPhoneNumber(displayPhoneNumber) ===
        normalizeDisplayPhoneNumber(opts.storedDisplayPhone));
    }
    return wrap({
      status: "VERIFIED",
      phoneNumberId: phoneId,
      metaId,
      displayPhoneNumber,
      verifiedName,
      belongsToWaba,
      wabaId: wabaId || null,
      checkedAt,
      source: "META_GRAPH_API",
      message: "Phone Number ID verificado actualmente mediante Meta Graph API.",
      unavailable: false,
    });
  }

  if (listedMatch) {
    return wrap({
      status: "VERIFIED",
      phoneNumberId: phoneId,
      metaId: listedMatch.id,
      displayPhoneNumber: listedMatch.displayPhoneNumber,
      verifiedName: listedMatch.verifiedName,
      belongsToWaba: true,
      wabaId: wabaId || null,
      checkedAt,
      source: "META_WABA_PHONE_NUMBERS",
      message: "Phone Number ID identificado entre los números asociados al WABA en Meta.",
      unavailable: false,
    });
  }

  const directUnavailable = isMetaGraphUnavailable(direct);
  const listUnavailable = list ? isMetaGraphUnavailable(list) : true;

  if (directUnavailable && listUnavailable) {
    const permissionLike =
      direct.status === 401 ||
      direct.status === 403 ||
      [10, 104, 190, 200].includes(
        Number(
          direct.json && typeof direct.json.error === "object" && direct.json.error
            ? (direct.json.error as { code?: number }).code
            : 0
        )
      );
    return wrap({
      status: "API_UNAVAILABLE",
      phoneNumberId: phoneId,
      metaId: null,
      displayPhoneNumber: null,
      verifiedName: null,
      belongsToWaba: null,
      wabaId: wabaId || null,
      checkedAt,
      source: null,
      message: permissionLike
        ? "La consulta del Phone Number ID no pudo completarse por permisos o credencial insuficiente frente a Meta. No se afirma que el identificador sea incorrecto."
        : "No fue posible realizar en este momento la comprobación del Phone Number ID contra Meta.",
      unavailable: true,
    });
  }

  if (direct.ok && directPicked?.id && !directIdMatch) {
    return wrap({
      status: "FAILED",
      phoneNumberId: phoneId,
      metaId: directPicked.id,
      displayPhoneNumber: directPicked.displayPhoneNumber,
      verifiedName: directPicked.verifiedName,
      belongsToWaba,
      wabaId: wabaId || null,
      checkedAt,
      source: "META_GRAPH_API",
      message: "El Phone Number ID consignado no coincide con la información devuelta por Meta.",
      unavailable: false,
    });
  }

  if (list?.ok) {
    return wrap({
      status: "FAILED",
      phoneNumberId: phoneId,
      metaId: null,
      displayPhoneNumber: null,
      verifiedName: null,
      belongsToWaba: false,
      wabaId: wabaId || null,
      checkedAt,
      source: "META_WABA_PHONE_NUMBERS",
      message: "El Phone Number ID consignado no coincide con la información devuelta por Meta.",
      unavailable: false,
    });
  }

  return wrap({
    status: "API_UNAVAILABLE",
    phoneNumberId: phoneId,
    metaId: null,
    displayPhoneNumber: null,
    verifiedName: null,
    belongsToWaba: null,
    wabaId: wabaId || null,
    checkedAt,
    source: null,
    message:
      "No fue posible realizar en este momento la comprobación del Phone Number ID contra Meta.",
    unavailable: true,
  });
}
