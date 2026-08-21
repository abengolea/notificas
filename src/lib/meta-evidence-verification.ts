import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { getEvidenceSnapshot } from "@/lib/evidence-snapshot";
import { listProviderEventsForMail } from "@/lib/provider-events";
import { metaAccountIdsFromSources } from "@/lib/pdf-evidence-format";
import {
  createMetaGraphFetcher,
  isSafeMetaObjectId,
  pickPhonePublic,
  pickTemplatePublic,
  pickWabaPublic,
  sha256Utf8,
  type MetaGraphFetcher,
} from "@/lib/meta-graph-client";
import { getWhatsAppAccessToken, getWhatsAppAppSecret } from "@/lib/meta-access-token";
import type { MetaVerifyStatus } from "@/lib/meta-verify-status";
import type { MetaCommunicationReport, MetaLiveIdentity, HistoricalMetaEvent } from "@/lib/meta-communication-types";
import {
  detectWamidMismatch,
  historicalEventFromProvider,
  mapEventKind,
  sendResponseEvent,
} from "@/lib/meta-webhook-evidence";

const CACHE_TTL_MS = 15 * 60 * 1000;
const FORCE_REFRESH_MIN_MS = 120 * 1000;
const WABA_FIELDS = "id,name,timezone_id,account_review_status";
const PHONE_FIELDS = "id,display_phone_number,verified_name,quality_rating,whatsapp_business_account{id}";
const TEMPLATE_FIELDS = "id,name,language,status,category";

type MailBundle = {
  mailId: string;
  mail: FirebaseFirestore.DocumentData;
  snapshot: Awaited<ReturnType<typeof getEvidenceSnapshot>>;
};

function asString(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function graphHttp(rec: unknown): Record<string, unknown> | null {
  if (!rec || typeof rec !== "object") return null;
  return rec as Record<string, unknown>;
}

export function extractSendGraphWamid(mail: FirebaseFirestore.DocumentData): string | null {
  const http = graphHttp(mail.waGraphHttp);
  if (http && typeof http.wamid === "string") return http.wamid;
  const parsed = mail.waGraphResponse;
  if (parsed && typeof parsed === "object") {
    const messages = (parsed as { messages?: Array<{ id?: string }> }).messages;
    const id = messages?.[0]?.id;
    if (typeof id === "string") return id;
  }
  return asString(mail.whatsappMessageId) || asString(mail.tracking?.whatsappMessageId);
}

export async function loadWhatsAppMailBundle(mailId: string): Promise<MailBundle | null> {
  const db = getAdminDb();
  const snap = await db.collection("mail").doc(mailId).get();
  if (!snap.exists) return null;
  const mail = snap.data()!;
  const snapshot = await getEvidenceSnapshot(mailId);
  return { mailId, mail, snapshot };
}

function evidenceIds(bundle: MailBundle) {
  const ids = metaAccountIdsFromSources({
    mail: bundle.mail,
    requestSnapshot: bundle.mail.waRequestSnapshot || bundle.snapshot?.whatsapp.requestSnapshot,
    envFallback: false,
  });
  const req =
    bundle.mail.waRequestSnapshot && typeof bundle.mail.waRequestSnapshot === "object"
      ? (bundle.mail.waRequestSnapshot as Record<string, unknown>)
      : bundle.snapshot?.whatsapp.requestSnapshot && typeof bundle.snapshot.whatsapp.requestSnapshot === "object"
        ? (bundle.snapshot.whatsapp.requestSnapshot as Record<string, unknown>)
        : {};
  return {
    wabaId: ids.wabaId,
    phoneNumberId: ids.phoneNumberId,
    templateId: asString(req.templateId) || asString(bundle.snapshot?.whatsapp.requestSnapshot && (bundle.snapshot.whatsapp.requestSnapshot as { templateId?: string }).templateId),
    templateName:
      asString(req.templateName) ||
      asString(bundle.mail.waTemplateName) ||
      asString(bundle.snapshot?.whatsapp.templateName),
    templateLang:
      asString(req.templateLang) ||
      asString(bundle.mail.waTemplateLang) ||
      asString(bundle.snapshot?.whatsapp.templateLang),
    wamid:
      asString(bundle.snapshot?.whatsapp.wamid) ||
      asString(bundle.mail.whatsappMessageId) ||
      asString(bundle.mail.tracking?.whatsappMessageId),
    recipientPhone:
      asString(bundle.snapshot?.recipient.phone) ||
      asString(bundle.mail.recipientPhone) ||
      asString(bundle.mail.tracking?.movements?.[0]?.recipientPhone),
  };
}

async function readCache(kind: string, id: string) {
  const doc = await getAdminDb().collection("meta_graph_cache").doc(`${kind}_${id}`).get();
  if (!doc.exists) return null;
  const data = doc.data() as { fetchedAt?: string; json?: Record<string, unknown>; httpStatus?: number };
  const fetchedAt = data.fetchedAt ? Date.parse(data.fetchedAt) : 0;
  if (!fetchedAt || Date.now() - fetchedAt > CACHE_TTL_MS) return null;
  return data;
}

async function writeCache(kind: string, id: string, json: Record<string, unknown> | null, httpStatus: number) {
  await getAdminDb()
    .collection("meta_graph_cache")
    .doc(`${kind}_${id}`)
    .set({
      kind,
      objectId: id,
      json,
      httpStatus,
      fetchedAt: new Date().toISOString(),
      responseHash: json ? sha256Utf8(JSON.stringify(json)) : null,
    });
}

async function writeAudit(input: {
  object: string;
  endpoint: string;
  httpStatus: number;
  durationMs: number;
  result: string;
  responseHash?: string | null;
  uid?: string | null;
}) {
  await getAdminDb().collection("meta_verification_audits").add({
    ...input,
    at: FieldValue.serverTimestamp(),
  });
}

async function liveCheck(opts: {
  kind: "waba" | "phone" | "template";
  id: string | null;
  fields: string;
  fetcher: MetaGraphFetcher | null;
  refresh: boolean;
  uid?: string | null;
  pick: (json: Record<string, unknown> | null) => Record<string, string | null> | null;
  verifiedMessage: string;
  missingMessage: string;
}): Promise<{ identity: MetaLiveIdentity | null; unavailable: boolean; queriedAt: string | null }> {
  if (!opts.id || !isSafeMetaObjectId(opts.id)) {
    return {
      identity: {
        id: opts.id || "",
        status: "NOT_AVAILABLE",
        message: opts.missingMessage,
        queriedAt: null,
        cached: false,
        fields: {},
        matchesEvidence: null,
      },
      unavailable: false,
      queriedAt: null,
    };
  }
  if (!opts.fetcher) {
    return {
      identity: {
        id: opts.id,
        status: "API_UNAVAILABLE",
        message: "No hay credencial de servidor configurada para consultar Meta Graph API.",
        queriedAt: null,
        cached: false,
        fields: {},
      },
      unavailable: true,
      queriedAt: null,
    };
  }

  let cached = false;
  let json: Record<string, unknown> | null = null;
  let httpStatus: number | null = null;
  let queriedAt = new Date().toISOString();
  let durationMs = 0;
  let timedOut = false;
  let ok = false;

  if (!opts.refresh) {
    const hit = await readCache(opts.kind, opts.id);
    if (hit) {
      cached = true;
      json = hit.json || null;
      httpStatus = hit.httpStatus ?? 200;
      queriedAt = hit.fetchedAt || queriedAt;
      ok = httpStatus !== null && httpStatus >= 200 && httpStatus < 300;
    }
  }

  if (!cached) {
    if (opts.refresh) {
      const hit = await readCache(opts.kind, opts.id);
      if (hit?.fetchedAt && Date.now() - Date.parse(hit.fetchedAt) < FORCE_REFRESH_MIN_MS) {
        cached = true;
        json = hit.json || null;
        httpStatus = hit.httpStatus ?? 200;
        queriedAt = hit.fetchedAt;
        ok = true;
      }
    }
  }

  if (!cached) {
    const res = await opts.fetcher(opts.id, opts.fields);
    durationMs = res.durationMs;
    httpStatus = res.status;
    json = res.json;
    ok = res.ok;
    timedOut = Boolean(res.timedOut);
    queriedAt = new Date().toISOString();
    if (res.ok) await writeCache(opts.kind, opts.id, json, res.status);
    await writeAudit({
      object: `${opts.kind}:${opts.id}`,
      endpoint: `GET /${opts.id}`,
      httpStatus: res.status,
      durationMs,
      result: res.timedOut ? "timeout" : res.ok ? "ok" : "error",
      responseHash: res.bodyHash,
      uid: opts.uid,
    });
    if (timedOut || res.status === 0) {
      return {
        identity: {
          id: opts.id,
          status: "API_UNAVAILABLE",
          message:
            "No fue posible realizar en este momento la consulta en vivo a Meta. Esto no afecta las comprobaciones históricas e inmutables de la constancia.",
          queriedAt,
          cached: false,
          fields: {},
        },
        unavailable: true,
        queriedAt,
      };
    }
  }

  const fields = opts.pick(json) || {};
  const idMatch = fields.id ? fields.id === opts.id : ok;
  const status: MetaVerifyStatus = ok && idMatch ? "VERIFIED" : ok ? "FAILED" : "FAILED";
  return {
    identity: {
      id: opts.id,
      status,
      message: status === "VERIFIED" ? opts.verifiedMessage : `Meta no confirmó el ${opts.kind} consignado.`,
      queriedAt,
      cached,
      fields,
      matchesEvidence: idMatch,
    },
    unavailable: false,
    queriedAt,
  };
}

export async function buildMetaCommunicationReport(opts: {
  mailId: string;
  refresh?: boolean;
  uid?: string | null;
  fetcher?: MetaGraphFetcher | null;
  now?: Date;
}): Promise<MetaCommunicationReport | null> {
  const bundle = await loadWhatsAppMailBundle(opts.mailId);
  if (!bundle) return null;
  const ids = evidenceIds(bundle);
  const hasWa = Boolean(
    ids.wamid || ids.phoneNumberId || ids.wabaId || ids.templateId || bundle.mail.waRequestSnapshot
  );
  if (!hasWa) {
    return {
      channel: "none",
      documentUnaffectedByLiveOutage: true,
      liveUnavailable: null,
      live: {
        waba: null,
        phone: null,
        template: null,
        lastLiveCheckAt: null,
        templateNameMatchesSnapshot: null,
        templateLangMatchesSnapshot: null,
        templateContentHistoricalNote:
          "Esta comunicación no tiene identificadores de WhatsApp Business conservados.",
      },
      message: {
        wamid: null,
        explanation: "No hay WAMID conservado para esta constancia.",
        wamidSource: "none",
        inSendResponse: false,
        sendResponseRawPreserved: false,
        sendHttpStatus: null,
        sendBodyHash: null,
      },
      inconsistencies: [],
      chronology: [],
      identification: {
        notificationId: opts.mailId,
        campaignId: asString(bundle.mail.campaignId),
        wamid: null,
        wabaId: null,
        phoneNumberId: null,
        templateId: null,
        templateName: null,
        templateLang: null,
      },
      disclaimer:
        "Las consultas en vivo permiten verificar determinados identificadores e infraestructura de WhatsApp Business directamente contra Meta. Los estados históricos del mensaje fueron comunicados oportunamente por Meta mediante webhooks y son conservados por Notificas junto con sus elementos técnicos de integridad y autenticación.",
    };
  }

  let fetcher = opts.fetcher ?? null;
  if (opts.fetcher === undefined) {
    const token = await getWhatsAppAccessToken();
    fetcher = token ? createMetaGraphFetcher({ accessToken: token }) : null;
  }

  const liveWaba = await liveCheck({
    kind: "waba",
    id: ids.wabaId,
    fields: WABA_FIELDS,
    fetcher,
    refresh: Boolean(opts.refresh),
    uid: opts.uid,
    pick: (j) => pickWabaPublic(j),
    verifiedMessage: "WABA ID verificado actualmente mediante Meta Graph API.",
    missingMessage: "No hay WABA ID conservado en la evidencia de este envío.",
  });
  const livePhone = await liveCheck({
    kind: "phone",
    id: ids.phoneNumberId,
    fields: PHONE_FIELDS,
    fetcher,
    refresh: Boolean(opts.refresh),
    uid: opts.uid,
    pick: (j) => pickPhonePublic(j),
    verifiedMessage: "Número de WhatsApp Business verificado actualmente mediante Meta Graph API.",
    missingMessage: "No hay Phone Number ID conservado en la evidencia de este envío.",
  });
  const liveTemplate = await liveCheck({
    kind: "template",
    id: ids.templateId,
    fields: TEMPLATE_FIELDS,
    fetcher,
    refresh: Boolean(opts.refresh),
    uid: opts.uid,
    pick: (j) => pickTemplatePublic(j),
    verifiedMessage: "Template identificado actualmente mediante Meta Graph API.",
    missingMessage: "No hay Template ID conservado en la evidencia de este envío.",
  });

  const liveOutage = liveWaba.unavailable || livePhone.unavailable || liveTemplate.unavailable;
  const phoneWaba = livePhone.identity?.fields.wabaId || null;
  const wabaAssoc =
    ids.wabaId && phoneWaba ? phoneWaba === ids.wabaId : null;

  const templateNameMatches =
    liveTemplate.identity?.fields.name && ids.templateName
      ? liveTemplate.identity.fields.name === ids.templateName
      : null;
  const templateLangMatches =
    liveTemplate.identity?.fields.language && ids.templateLang
      ? liveTemplate.identity.fields.language === ids.templateLang
      : null;

  const http = graphHttp(bundle.mail.waGraphHttp);
  const sendWamid = extractSendGraphWamid(bundle.mail);
  const sendRaw =
    typeof http?.body === "string" || typeof http?.bodyHash === "string";
  const sendHttpStatus = typeof http?.status === "number" ? http.status : null;
  const sendBodyHash = asString(http?.bodyHash);

  const events = await listProviderEventsForMail(opts.mailId, 40).catch(() => []);
  const metaEvents = events.filter((e) => (e as { provider?: string }).provider === "meta");

  const integrityEvents = bundle.mail.campaignId
    ? await (async () => {
        try {
          const { verifyCampaignMessage } = await import("@/lib/campaign-integrity");
          const cmId = asString(bundle.mail.campaignMessageId);
          if (!cmId) {
            const cm = await getAdminDb()
              .collection("campaign_messages")
              .where("mailId", "==", opts.mailId)
              .limit(1)
              .get();
            if (cm.empty) return null;
            return verifyCampaignMessage(String(bundle.mail.campaignId), cm.docs[0].id);
          }
          return verifyCampaignMessage(String(bundle.mail.campaignId), cmId);
        } catch {
          return null;
        }
      })()
    : null;

  const polyByType: Record<string, HistoricalMetaEvent["polygon"]> = {};
  for (const ev of integrityEvents?.events || []) {
    if (!ev.present) continue;
    if (ev.type === "wa_delivered") {
      polyByType.delivered = {
        txHash: ev.txHash,
        merkleRoot: ev.merkleRoot,
        leafHash: ev.leafHash,
        leafIndex: ev.leafIndex,
        proof: ev.proof,
        merkleValid: ev.merkleValid,
        batchId: ev.batchId,
      };
    }
    if (ev.type === "wa_read") {
      polyByType.read = {
        txHash: ev.txHash,
        merkleRoot: ev.merkleRoot,
        leafHash: ev.leafHash,
        leafIndex: ev.leafIndex,
        proof: ev.proof,
        merkleValid: ev.merkleValid,
        batchId: ev.batchId,
      };
    }
  }
  const waDeliveredTx = asString(bundle.mail.polygonCertifications?.waDelivered);
  const waReadTx = asString(bundle.mail.polygonCertifications?.waRead);
  if (waDeliveredTx) polyByType.delivered = { ...(polyByType.delivered || {}), txHash: waDeliveredTx };
  if (waReadTx) polyByType.read = { ...(polyByType.read || {}), txHash: waReadTx };

  const appSecret = (await getWhatsAppAppSecret()) || null;
  const chronology: HistoricalMetaEvent[] = [];
  chronology.push(
    sendResponseEvent({
      wamid: sendWamid,
      httpStatus: sendHttpStatus,
      bodyHash: sendBodyHash,
      receivedAt: asString(http?.receivedAt),
      rawPreserved: sendRaw,
    })
  );
  for (const ev of metaEvents) {
    const kind = String((ev as { eventType?: string }).eventType || "");
    chronology.push(
      historicalEventFromProvider(ev as never, {
        expectedWamid: ids.wamid || sendWamid,
        expectedRecipient: ids.recipientPhone,
        appSecret,
        polygon: polyByType[mapEventKind(kind)],
      })
    );
  }
  chronology.sort((a, b) => {
    if (a.source === "meta_send_response" && b.source !== "meta_send_response") return -1;
    if (b.source === "meta_send_response" && a.source !== "meta_send_response") return 1;
    const ta = Date.parse(a.metaTimestamp || "") || 0;
    const tb = Date.parse(b.metaTimestamp || "") || 0;
    if (ta !== tb) return ta - tb;
    const rank = (k: string) => (k === "sent" ? 0 : k === "delivered" ? 1 : k === "read" ? 2 : 3);
    return rank(a.kind) - rank(b.kind);
  });

  const inconsistencies: MetaCommunicationReport["inconsistencies"] = [];
  for (const ev of chronology) {
    if (ev.kind !== "sent" && detectWamidMismatch(sendWamid || ids.wamid, ev.wamid)) {
      inconsistencies.push({
        code: "wamid_mismatch",
        message: "El WAMID del webhook no coincide con el WAMID conservado en la respuesta de envío.",
        status: "FAILED",
      });
    }
    if (ev.status === "FAILED" && ev.signatureValidation === "incorrect") {
      inconsistencies.push({
        code: "signature_failed",
        message: "La autenticación técnica X-Hub-Signature-256 no coincide con el payload conservado.",
        status: "FAILED",
      });
    }
  }
  if (wabaAssoc === false) {
    inconsistencies.push({
      code: "phone_waba_mismatch",
      message: "El Phone Number ID consultado en vivo no aparece asociado al WABA consignado en la evidencia.",
      status: "FAILED",
    });
  }

  const lastLive =
    liveWaba.queriedAt || livePhone.queriedAt || liveTemplate.queriedAt || null;

  return {
    channel: "whatsapp",
    documentUnaffectedByLiveOutage: true,
    liveUnavailable: liveOutage
      ? {
          status: "API_UNAVAILABLE",
          message:
            "No fue posible realizar en este momento la consulta en vivo a Meta. Esto no afecta las comprobaciones históricas e inmutables de la constancia.",
        }
      : null,
    live: {
      waba: liveWaba.identity,
      phone: livePhone.identity,
      template: liveTemplate.identity,
      lastLiveCheckAt: lastLive,
      templateNameMatchesSnapshot: templateNameMatches,
      templateLangMatchesSnapshot: templateLangMatches,
      templateContentHistoricalNote:
        "El contenido histórico enviado se demuestra con el snapshot conservado al momento del envío. Un template actualmente existente en Meta pudo haber cambiado después; no se afirma identidad automática del texto histórico con el template vivo.",
    },
    message: {
      wamid: ids.wamid || sendWamid,
      explanation:
        "Identificador asignado por Meta al procesamiento del mensaje. No se consulta GET sobre el WAMID: Meta no ofrece una API documentada para recuperar retrospectivamente el estado de un mensaje a partir de ese identificador.",
      wamidSource: sendRaw ? "graph_http_raw" : sendWamid ? "parsed_graph_json" : ids.wamid ? "extracted_id_only" : "none",
      inSendResponse: Boolean(sendWamid),
      sendResponseRawPreserved: sendRaw,
      sendHttpStatus,
      sendBodyHash,
    },
    inconsistencies,
    chronology,
    identification: {
      notificationId: opts.mailId,
      campaignId: asString(bundle.mail.campaignId),
      wamid: ids.wamid || sendWamid,
      wabaId: ids.wabaId,
      phoneNumberId: ids.phoneNumberId,
      templateId: ids.templateId,
      templateName: ids.templateName,
      templateLang: ids.templateLang,
    },
    disclaimer:
      "Las consultas en vivo permiten verificar determinados identificadores e infraestructura de WhatsApp Business directamente contra Meta. Los estados históricos de entrega y lectura no se consultan actualmente a Meta: corresponden a eventos que Meta comunicó oportunamente a Notificas mediante webhooks y cuya evidencia técnica fue preservada.",
  };
}
