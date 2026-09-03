import { getAdminDb } from "@/lib/firebase-admin";
import { getEvidenceSnapshot } from "@/lib/evidence-snapshot";
import { listProviderEventsForMail } from "@/lib/provider-events";
import { findMailForResendEvent } from "@/lib/resend-webhook";
import {
  createResendEmailFetcher,
  lastEventClaim,
  pickResendEmailPublic,
  type ResendEmailFetchResult,
} from "@/lib/resend-api-client";
import {
  historicalEventFromResend,
  RESEND_VERIFICATION_DISCLAIMER,
  resendLiveFailureDoesNotInvalidateHistory,
  type ResendSignatureRecord,
} from "@/lib/resend-webhook-evidence";
import type { HistoricalResendEvent, ResendCommunicationReport, ResendLiveEmail } from "@/lib/resend-communication-types";

export { resendLiveFailureDoesNotInvalidateHistory };

function asString(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

export async function resolveResendMailId(input: {
  messageId?: string;
  campaignId?: string;
}): Promise<string | null> {
  const db = getAdminDb();
  const messageId = input.messageId?.trim();
  if (!messageId) return null;

  const mail = await db.collection("mail").doc(messageId).get();
  if (mail.exists) return mail.id;

  const cm = await db.collection("campaign_messages").doc(messageId).get();
  if (cm.exists) {
    const mailId = cm.data()?.mailId;
    if (typeof mailId === "string" && mailId) return mailId;
  }

  if (input.campaignId) {
    const byCamp = await db
      .collection("campaign_messages")
      .where("campaignId", "==", input.campaignId)
      .where("mailId", "==", messageId)
      .limit(1)
      .get();
    if (!byCamp.empty) {
      const mailId = byCamp.docs[0].data()?.mailId;
      if (typeof mailId === "string") return mailId;
    }
  }

  const byIds = await findMailForResendEvent({
    providerMessageId: messageId,
    smtpMessageId: messageId,
  });
  if (byIds) return byIds.id;

  const eventDoc = await db.collection("email_provider_events").doc(messageId).get();
  if (eventDoc.exists) {
    const mailId = eventDoc.data()?.mailId;
    if (typeof mailId === "string" && mailId) return mailId;
  }

  const byEmailId = await db
    .collection("email_provider_events")
    .where("providerMessageId", "==", messageId)
    .limit(1)
    .get();
  if (!byEmailId.empty) {
    const mailId = byEmailId.docs[0].data()?.mailId;
    if (typeof mailId === "string" && mailId) return mailId;
  }

  return null;
}

function isResendChannel(
  mail: FirebaseFirestore.DocumentData,
  events: HistoricalResendEvent[]
): boolean {
  if (events.length > 0) return true;
  const transport = mail.transport && typeof mail.transport === "object" ? mail.transport as { provider?: unknown } : null;
  if (asString(transport?.provider) === "resend") return true;
  if (asString(mail.providerMessageId)) return true;
  return false;
}

function eventKey(ev: HistoricalResendEvent, fallback: string): string {
  return [
    ev.kind,
    ev.emailId || "",
    ev.providerTimestamp || "",
    ev.payloadSha256 || "",
    fallback,
  ].join("|");
}

async function listEmailProviderEvents(mailId: string, emailId: string | null): Promise<ResendSignatureRecord[]> {
  const db = getAdminDb();
  const seen = new Set<string>();
  const out: ResendSignatureRecord[] = [];
  const addSnap = (docs: FirebaseFirestore.QueryDocumentSnapshot[]) => {
    for (const d of docs) {
      if (seen.has(d.id)) continue;
      seen.add(d.id);
      out.push({ webhookEventId: d.id, ...d.data() } as ResendSignatureRecord);
    }
  };

  const byMail = await db.collection("email_provider_events").where("mailId", "==", mailId).limit(80).get();
  addSnap(byMail.docs);
  if (emailId) {
    const byEmail = await db
      .collection("email_provider_events")
      .where("providerMessageId", "==", emailId)
      .limit(80)
      .get();
    addSnap(byEmail.docs);
  }
  return out;
}

function sortChronology(events: HistoricalResendEvent[]): HistoricalResendEvent[] {
  return [...events].sort((a, b) => {
    const ta = Date.parse(a.providerTimestamp || a.receivedAt || "") || 0;
    const tb = Date.parse(b.providerTimestamp || b.receivedAt || "") || 0;
    return ta - tb;
  });
}

export async function buildResendCommunicationReport(opts: {
  mailId: string;
  refresh?: boolean;
  fetchImpl?: typeof fetch;
}): Promise<ResendCommunicationReport | null> {
  const db = getAdminDb();
  const mailSnap = await db.collection("mail").doc(opts.mailId).get();
  if (!mailSnap.exists) return null;
  const mail = mailSnap.data()!;
  const snapshot = await getEvidenceSnapshot(opts.mailId);

  const emailId = asString(mail.providerMessageId);
  const smtpMessageId = asString(mail.smtpMessageId) || asString(snapshot?.smtp?.messageId);
  const recipientEmail =
    asString(mail.recipientEmail) ||
    asString(snapshot?.recipient?.email) ||
    (Array.isArray(mail.to) ? asString(mail.to[0]) : asString(mail.to));
  const subject = asString(mail.subject) || asString(snapshot?.subject);
  const campaignId = asString(mail.campaignId) || asString(snapshot?.campaignId);
  const campaignMessageId = asString(mail.campaignMessageId) || asString(snapshot?.campaignMessageId);

  const secret = (process.env.RESEND_WEBHOOK_SECRET || "").trim() || null;
  const primary = await listEmailProviderEvents(opts.mailId, emailId);
  const chronology: HistoricalResendEvent[] = primary.map((rec) =>
    historicalEventFromResend(rec, secret, "resend_webhook_historical")
  );

  const seen = new Set(chronology.map((ev, i) => eventKey(ev, String(i))));
  const providerEvents = await listProviderEventsForMail(opts.mailId, 80);
  for (const raw of providerEvents) {
    const rec = raw as ResendSignatureRecord & { provider?: unknown; id?: string };
    if (asString(rec.provider) !== "resend") continue;
    const ev = historicalEventFromResend(rec, secret, "provider_events");
    const key = eventKey(ev, asString(rec.id) || "pe");
    if (seen.has(key)) continue;
    seen.add(key);
    chronology.push(ev);
  }

  const sorted = sortChronology(chronology);
  const channel = isResendChannel(mail, sorted) ? "email" : "none";

  const live = await queryLiveResend({
    emailId: emailId || sorted.find((e) => e.emailId)?.emailId || null,
    fetchImpl: opts.fetchImpl,
  });

  return {
    channel,
    documentUnaffectedByLiveOutage: true,
    liveUnavailable: live.unavailable,
    live: {
      email: live.email,
      lastLiveCheckAt: live.email?.queriedAt || (live.unavailable ? new Date().toISOString() : null),
    },
    identification: {
      notificationId: opts.mailId,
      campaignId,
      campaignMessageId,
      emailId: emailId || live.email?.emailId || null,
      smtpMessageId,
      recipientEmail,
      subject,
    },
    inconsistencies: [],
    chronology: sorted,
    disclaimer: RESEND_VERIFICATION_DISCLAIMER,
  };
}

async function queryLiveResend(opts: {
  emailId: string | null;
  fetchImpl?: typeof fetch;
}): Promise<{
  email: ResendLiveEmail | null;
  unavailable: ResendCommunicationReport["liveUnavailable"];
}> {
  const queriedAt = new Date().toISOString();
  const apiKey = (process.env.RESEND_API_KEY || "").trim();
  if (!opts.emailId) {
    return {
      email: {
        status: "NOT_AVAILABLE",
        message: "No hay email_id de Resend conservado para consultar en vivo.",
        queriedAt,
        emailId: null,
        lastEvent: null,
        createdAt: null,
        subject: null,
        from: null,
        to: null,
      },
      unavailable: null,
    };
  }
  if (!apiKey) {
    return {
      email: null,
      unavailable: {
        status: "API_UNAVAILABLE",
        message:
          "No hay clave de API de Resend configurada en este entorno. La cronología histórica no se invalida.",
      },
    };
  }

  let result: ResendEmailFetchResult;
  try {
    const fetcher = createResendEmailFetcher({ apiKey, fetchImpl: opts.fetchImpl });
    result = await fetcher(opts.emailId);
  } catch {
    return {
      email: null,
      unavailable: {
        status: "API_UNAVAILABLE",
        message:
          "La consulta actual a api.resend.com no está disponible. Los webhooks históricos conservados no se invalidan.",
      },
    };
  }

  if (!result.ok) {
    if (result.httpStatus === 404) {
      return {
        email: {
          status: "NOT_AVAILABLE",
          message: "Resend no devolvió este email_id en la consulta actual. Eso no borra los webhooks históricos.",
          queriedAt,
          emailId: opts.emailId,
          lastEvent: null,
          createdAt: null,
          subject: null,
          from: null,
          to: null,
        },
        unavailable: null,
      };
    }
    return {
      email: null,
      unavailable: {
        status: "API_UNAVAILABLE",
        message: `Resend respondió HTTP ${result.httpStatus}. La cronología histórica no se invalida.`,
      },
    };
  }

  const picked = pickResendEmailPublic(result.json);
  if (!picked) {
    return {
      email: null,
      unavailable: {
        status: "API_UNAVAILABLE",
        message: "Resend respondió sin un objeto de email reconocible. La cronología histórica no se invalida.",
      },
    };
  }

  return {
    email: {
      status: "VERIFIED",
      message: lastEventClaim(picked.lastEvent),
      queriedAt,
      emailId: picked.id,
      lastEvent: picked.lastEvent,
      createdAt: picked.createdAt,
      subject: picked.subject,
      from: picked.from,
      to: picked.to,
    },
    unavailable: null,
  };
}
