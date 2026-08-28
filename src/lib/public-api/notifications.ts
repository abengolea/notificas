import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb, getAdminBucket } from "@/lib/firebase-admin";
import { createMailDocumentAdmin } from "@/lib/email-server";
import { enqueuePublicApiSend } from "@/lib/cloud-tasks";
import { normalizeEnviosDisponibles } from "@/lib/envios";
import { buildCampaignMailHtml, campaignBodyToHtmlFragment } from "@/lib/campaign-email-html";
import { constanciaEnvioStoragePath } from "@/lib/constancia-envio-pdf";
import { isSyntheticCampaignEmail, phoneDigits, presentRecipientValue } from "@/lib/parse-campaign-csv";
import { resolveOrgTemplate } from "@/lib/public-api/templates";
import { decodeCursor, encodeCursor } from "@/lib/public-api/cursor";
import { invalidRequest, notFound, unprocessable } from "@/lib/public-api/errors";
import { newNotificationId } from "@/lib/public-api/ids";
import { maskEmail, maskPhone } from "@/lib/public-api/mask";
import { isSandboxRecipientAllowed, mergeAllowlist, type SandboxAllowlist } from "@/lib/public-api/sandbox";
import { assertTenant } from "@/lib/public-api/tenant";
import {
  certificateStatusFromMail,
  normalizeNotificationStatus,
  type PublicCertificateStatus,
  type PublicNotificationStatus,
} from "@/lib/public-api/status";
import { emitPublicApiEvent } from "@/lib/public-api/webhooks";
import type { PublicApiAuthContext } from "@/lib/public-api/types";
import { COLLECTIONS } from "@/lib/public-api/types";
import {
  createNotificationSchema,
  isValidEmail,
  listNotificationsQuerySchema,
  normalizePhoneOrError,
  sanitizeMetadata,
  sanitizeVariables,
  type CreateNotificationInput,
} from "@/lib/public-api/validation";

function applyVariables(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => vars[key] ?? "");
}

function toIso(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  if (typeof value === "string") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? value : d.toISOString();
  }
  if (typeof value === "object" && value && "toDate" in value && typeof (value as { toDate: () => Date }).toDate === "function") {
    try {
      return (value as { toDate: () => Date }).toDate().toISOString();
    } catch {
      return null;
    }
  }
  if (typeof value === "object" && value && typeof (value as { seconds?: number }).seconds === "number") {
    return new Date((value as { seconds: number }).seconds * 1000).toISOString();
  }
  return null;
}

function recipientSearchTokens(phone?: string, email?: string, document?: string): string[] {
  const tokens = new Set<string>();
  const digits = phoneDigits(phone);
  if (digits) tokens.add(digits);
  const em = (email || "").trim().toLowerCase();
  if (em && !isSyntheticCampaignEmail(em)) tokens.add(em);
  const doc = String(document || "").replace(/\D/g, "");
  if (doc) tokens.add(doc);
  return [...tokens];
}

export function serializeNotification(row: FirebaseFirestore.DocumentData, id: string) {
  const channel = row.channel === "email" ? "email" : "whatsapp";
  const recipient: Record<string, string> = {};
  const maskedPhone = maskPhone(row.recipientPhone);
  const maskedEmail = maskEmail(row.recipientEmail);
  if (channel === "whatsapp" && maskedPhone) recipient.phone = maskedPhone;
  if (channel === "email" && maskedEmail) recipient.email = maskedEmail;
  if (channel === "whatsapp" && maskedEmail) recipient.email = maskedEmail;
  return {
    id,
    status: row.status as PublicNotificationStatus,
    channel,
    recipient,
    reference: row.reference || null,
    created_at: toIso(row.createdAt),
    sent_at: toIso(row.sentAt),
    delivered_at: toIso(row.deliveredAt),
    read_at: toIso(row.readAt),
    failed_at: toIso(row.failedAt),
    certificate_status: row.certificateStatus || "processing",
    test_mode: row.testMode === true,
  };
}

async function orgAllowlist(orgId: string): Promise<SandboxAllowlist> {
  const snap = await getAdminDb().collection("organizations").doc(orgId).get();
  const raw = snap.data()?.apiSandboxAllowlist;
  return mergeAllowlist({
    phones: Array.isArray(raw?.phones) ? raw.phones.map(String) : [],
    emails: Array.isArray(raw?.emails) ? raw.emails.map(String) : [],
  });
}

export { creditsRequiredForNotification } from "@/lib/envios";

export async function peekAvailableCredits(uid: string): Promise<number> {
  const snap = await getAdminDb().collection("users").doc(uid).get();
  return normalizeEnviosDisponibles(snap.data()?.creditos);
}

async function consumeCredit(uid: string, origin: "public_api" | "mcp" = "public_api"): Promise<void> {
  const db = getAdminDb();
  const userRef = db.collection("users").doc(uid);
  await db.runTransaction(async (t) => {
    const snap = await t.get(userRef);
    const available = normalizeEnviosDisponibles(snap.data()?.creditos);
    if (available < 1) {
      throw unprocessable("insufficient_credits", "The account has no remaining sends.");
    }
    t.update(userRef, {
      creditos: FieldValue.increment(-1),
      updatedAt: FieldValue.serverTimestamp(),
    });
  });
  await db.collection("user_transactions").add({
    userId: uid,
    tipo: "envio",
    descripcion: origin === "mcp" ? "Envío MCP" : "Envío API pública",
    creditos: -1,
    monto: 0,
    createdAt: FieldValue.serverTimestamp(),
    source: origin,
  });
}

export async function createPublicNotification(
  ctx: PublicApiAuthContext,
  rawBody: unknown
): Promise<{ httpStatus: number; body: Record<string, unknown> }> {
  const parsed = createNotificationSchema.safeParse(rawBody);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw invalidRequest("invalid_request", issue?.message || "Invalid request.", issue?.path.join(".") || undefined);
  }
  const input: CreateNotificationInput = parsed.data;
  const variables = sanitizeVariables(input.variables);
  const metadata = {
    ...sanitizeMetadata(input.metadata as Record<string, string | number | boolean> | undefined),
    ...(ctx.origin === "mcp" ? { source: "mcp", ...(ctx.mcpClient ? { client: ctx.mcpClient } : {}) } : {}),
  };
  const reference = input.reference?.trim() || null;

  let phone: string | undefined;
  let email: string | undefined;
  if (input.channel === "whatsapp") {
    const n = normalizePhoneOrError(input.recipient.phone);
    if (!n.ok) throw invalidRequest("invalid_phone", "The recipient phone number is invalid.", "recipient.phone");
    phone = n.phone;
    if (input.recipient.email) {
      if (!isValidEmail(input.recipient.email)) {
        throw invalidRequest("invalid_email", "The recipient email is invalid.", "recipient.email");
      }
      email = input.recipient.email.trim().toLowerCase();
    }
  } else {
    if (!input.recipient.email || !isValidEmail(input.recipient.email)) {
      throw invalidRequest("invalid_email", "The recipient email is invalid.", "recipient.email");
    }
    email = input.recipient.email.trim().toLowerCase();
    if (input.recipient.phone) {
      const n = normalizePhoneOrError(input.recipient.phone);
      if (!n.ok) throw invalidRequest("invalid_phone", "The recipient phone number is invalid.", "recipient.phone");
      phone = n.phone;
    }
  }

  const tpl = await resolveOrgTemplate(ctx.orgId, input.template, input.channel);
  if (input.channel === "whatsapp" && !input.template && !tpl.useDefault) {
    throw invalidRequest("missing_template", "A WhatsApp template is required.", "template");
  }
  if (input.channel === "email" && !input.subject && !input.body && !input.template) {
    throw invalidRequest("missing_content", "Email notifications require subject and body, or a template.", "body");
  }

  const allowlist = await orgAllowlist(ctx.orgId);
  const sandboxAllowed = ctx.testMode && isSandboxRecipientAllowed({ allowlist, phone, email });
  const simulate = ctx.testMode && !sandboxAllowed;
  const realSend = !simulate;

  const publicId = newNotificationId(ctx.testMode);
  const name = input.recipient.name?.trim() || variables.nombre || "Destinatario";
  const document = (input.recipient.document || variables.dni || "").replace(/\D/g, "") || undefined;
  const vars: Record<string, string> = {
    ...variables,
    nombre: variables.nombre || name,
    dni: variables.dni || document || "",
  };
  const subject = applyVariables(input.subject || "Notificación", vars);
  const bodyPlain = applyVariables(input.body || "", vars) || `${name}`;
  const html = buildCampaignMailHtml({
    recipientEmail: email || `wa-${phoneDigits(phone)}@notificas.internal`,
    recipientName: name,
    sender: ctx.senderEmail || ctx.orgName || "Notificas",
    bodyHtml: campaignBodyToHtmlFragment(bodyPlain),
    attachments: [],
  });
  const to = email && !isSyntheticCampaignEmail(email) ? email : `wa-${phoneDigits(phone)}@notificas.internal`;
  const waOnly = input.channel === "whatsapp";

  if (realSend) {
    await consumeCredit(ctx.senderUid, ctx.origin === "mcp" ? "mcp" : "public_api");
  }

  const mailId = await createMailDocumentAdmin({
    to,
    subject,
    html,
    text: bodyPlain,
    from: "contacto@notificas.com",
    replyTo: ctx.senderEmail.includes("@") ? ctx.senderEmail : undefined,
    senderName: ctx.senderEmail || ctx.orgName,
    recipientName: name,
    recipientEmail: to,
    recipientPhone: phone,
    recipientDni: document,
    recipientDias: vars.dias,
    recipientFecha: vars.fecha,
    recipientMonto: vars.monto,
    recipientCuotas: presentRecipientValue(vars.cuotas) ? vars.cuotas : undefined,
    createdBy: ctx.senderUid,
    waOnly,
    simulated: simulate,
    orgId: ctx.orgId,
    publicApiId: publicId,
    apiSource: ctx.origin === "mcp" ? "mcp" : "public_api",
    apiKeyId: ctx.apiKeyId,
    mcpClient: ctx.mcpClient || undefined,
    apiReference: reference || undefined,
    apiMetadata: metadata,
    apiChannel: input.channel,
    testMode: ctx.testMode,
    requestId: ctx.requestId,
    ...(tpl.useDefault
      ? {}
      : {
          waTemplateName: tpl.templateName,
          waTemplateLang: tpl.templateLang,
          waTemplateVariables: tpl.templateVariables,
          ...(tpl.urlButton ? { waUrlButton: true } : {}),
        }),
  });

  const createdAt = new Date().toISOString();
  const status: PublicNotificationStatus = simulate ? "delivered" : "queued";
  const cert: PublicCertificateStatus = simulate ? "sandbox" : "processing";

  await getAdminDb()
    .collection(COLLECTIONS.apiNotifications)
    .doc(publicId)
    .set({
      id: publicId,
      orgId: ctx.orgId,
      mailId,
      channel: input.channel,
      status,
      reference,
      recipientPhone: phone || null,
      recipientEmail: email || null,
      recipientName: name,
      recipientSearch: recipientSearchTokens(phone, email, document),
      createdAt: FieldValue.serverTimestamp(),
      createdAtIso: createdAt,
      ...(simulate ? { deliveredAt: FieldValue.serverTimestamp() } : {}),
      certificateStatus: cert,
      testMode: ctx.testMode,
      apiKeyId: ctx.apiKeyId,
      requestId: ctx.requestId,
      metadata,
    });

  if (simulate) {
    await getAdminDb()
      .collection("mail")
      .doc(mailId)
      .update({
        simulated: true,
        testMode: true,
        delivery: {
          state: "DELIVERED",
          time: createdAt,
          info: "sandbox",
        },
      })
      .catch(() => undefined);
  } else {
    await enqueuePublicApiSend({ mailId, notificationId: publicId }).catch((e) =>
      console.warn("public-api enqueue send", e instanceof Error ? e.message : e)
    );
  }

  await emitPublicApiEvent({
    type: simulate ? "notification.delivered" : "notification.queued",
    orgId: ctx.orgId,
    environment: ctx.environment,
    data: {
      notification_id: publicId,
      reference,
      status,
    },
  }).catch((e) => console.warn("public-api queued event", e instanceof Error ? e.message : e));

  const body = {
    id: publicId,
    status,
    channel: input.channel,
    recipient: input.channel === "whatsapp" ? { phone: maskPhone(phone) } : { email: maskEmail(email) },
    reference,
    created_at: createdAt,
    ...(ctx.testMode ? { test_mode: true } : {}),
  };
  return { httpStatus: 201, body };
}

export async function getPublicNotification(ctx: PublicApiAuthContext, id: string) {
  const snap = await getAdminDb().collection(COLLECTIONS.apiNotifications).doc(id).get();
  if (!snap.exists) throw notFound("notification_not_found", "Notification not found.");
  const data = snap.data()!;
  assertTenant(String(data.orgId || ""), ctx.orgId);
  if (Boolean(data.testMode) !== ctx.testMode) throw notFound("notification_not_found", "Notification not found.");
  return serializeNotification(data, snap.id);
}

export async function listPublicNotifications(
  ctx: PublicApiAuthContext,
  query: Record<string, string | undefined>
) {
  const parsed = listNotificationsQuerySchema.safeParse(query);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw invalidRequest("invalid_request", issue?.message || "Invalid query.", issue?.path.join(".") || undefined);
  }
  const q = parsed.data;
  const limit = q.limit ?? 50;
  const db = getAdminDb();
  let ref: FirebaseFirestore.Query = db
    .collection(COLLECTIONS.apiNotifications)
    .where("orgId", "==", ctx.orgId)
    .where("testMode", "==", ctx.testMode);

  if (q.recipient) {
    const token = q.recipient.includes("@") ? q.recipient.trim().toLowerCase() : phoneDigits(q.recipient) || q.recipient.trim();
    ref = ref.where("recipientSearch", "array-contains", token);
  } else if (q.reference) {
    ref = ref.where("reference", "==", q.reference);
  } else if (q.status) {
    ref = ref.where("status", "==", q.status);
  } else if (q.channel) {
    ref = ref.where("channel", "==", q.channel);
  }

  ref = ref.orderBy("createdAt", "desc").orderBy("__name__", "desc").limit(limit + 1);

  const cursor = decodeCursor(q.cursor);
  if (cursor) {
    const cursorSnap = await db.collection(COLLECTIONS.apiNotifications).doc(cursor.id).get();
    if (cursorSnap.exists && cursorSnap.data()?.orgId === ctx.orgId) {
      ref = ref.startAfter(cursorSnap);
    }
  }

  const snap = await ref.get();
  let docs = snap.docs;
  if (q.status && q.recipient) docs = docs.filter((d) => d.data().status === q.status);
  if (q.channel && (q.recipient || q.reference || q.status)) {
    docs = docs.filter((d) => d.data().channel === q.channel);
  }
  if (q.reference && q.recipient) docs = docs.filter((d) => d.data().reference === q.reference);
  if (q.created_from || q.created_to) {
    const from = q.created_from ? Date.parse(q.created_from) : 0;
    const to = q.created_to ? Date.parse(q.created_to) : Number.MAX_SAFE_INTEGER;
    docs = docs.filter((d) => {
      const iso = toIso(d.data().createdAt);
      const ms = iso ? Date.parse(iso) : 0;
      return ms >= from && ms <= to;
    });
  }
  const page = docs.slice(0, limit);
  const hasMore = docs.length > limit;
  const last = page[page.length - 1];
  const nextCursor =
    hasMore && last
      ? encodeCursor({
          createdAtMs: Date.parse(toIso(last.data().createdAt) || "") || 0,
          id: last.id,
        })
      : null;

  return {
    data: page.map((d) => serializeNotification(d.data(), d.id)),
    has_more: Boolean(nextCursor),
    cursor: nextCursor,
  };
}

export async function getPublicCertificate(ctx: PublicApiAuthContext, id: string) {
  const snap = await getAdminDb().collection(COLLECTIONS.apiNotifications).doc(id).get();
  if (!snap.exists) throw notFound("notification_not_found", "Notification not found.");
  const data = snap.data()!;
  assertTenant(String(data.orgId || ""), ctx.orgId);
  if (Boolean(data.testMode) !== ctx.testMode) throw notFound("notification_not_found", "Notification not found.");

  if (data.testMode === true && data.certificateStatus === "sandbox") {
    return {
      status: "processing" as const,
      test_mode: true,
      message:
        "Sandbox notifications do not generate a production constancia unless the recipient is on the allowlist and a real send occurred.",
    };
  }

  const mailId = String(data.mailId || "");
  const mailSnap = await getAdminDb().collection("mail").doc(mailId).get();
  const mail = mailSnap.data() || {};
  const cert = certificateStatusFromMail({
    evidenceSealed: mail.evidenceSealed,
    evidenceSnapshotHash: mail.evidenceSnapshotHash,
    constanciaPath: mail.constanciaEnvioPath,
    testMode: data.testMode === true,
    simulated: mail.simulated === true,
    realSend: mail.simulated !== true,
  });
  if (cert !== "ready") {
    return { status: "processing" as const, ...(data.testMode ? { test_mode: true } : {}) };
  }

  const path = constanciaEnvioStoragePath(mailId);
  const expires = new Date(Date.now() + 15 * 60 * 1000);
  try {
    const [url] = await getAdminBucket()
      .file(path)
      .getSignedUrl({
        version: "v4",
        action: "read",
        expires,
      });
    return {
      status: "ready" as const,
      kind: "constancia_envio",
      download_url: url,
      expires_at: expires.toISOString(),
      ...(data.testMode ? { test_mode: true } : {}),
    };
  } catch (e) {
    console.warn("public-api signed url", e instanceof Error ? e.message : e);
    return { status: "processing" as const };
  }
}

export { normalizeNotificationStatus };
