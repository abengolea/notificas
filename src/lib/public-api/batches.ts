import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { saveAllRecipientChunks } from "@/lib/campaign-recipients-storage";
import { startCampaignTanda } from "@/lib/campaign-start-tanda";
import { maxRecipientsForPlan } from "@/lib/org-limits-client";
import { isSyntheticCampaignEmail, presentRecipientValue, recipientValueText } from "@/lib/parse-campaign-csv";
import type { CanalCampaign, RecipientEntry } from "@/lib/types";
import { usesNotificasDefaultTemplate, WA_DEFAULT_TEMPLATE_NAME } from "@/lib/wa-template-fields";
import { mapSavedWaTemplate } from "@/lib/wa-saved-template";
import { invalidRequest, notFound, PublicApiError, unprocessable } from "@/lib/public-api/errors";
import { newBatchId } from "@/lib/public-api/ids";
import { isSandboxRecipientAllowed, mergeAllowlist } from "@/lib/public-api/sandbox";
import { normalizeBatchStatus } from "@/lib/public-api/status";
import { assertTenant } from "@/lib/public-api/tenant";
import type { PublicApiAuthContext } from "@/lib/public-api/types";
import { COLLECTIONS } from "@/lib/public-api/types";
import {
  createBatchSchema,
  isValidEmail,
  MAX_BATCH_RECIPIENTS,
  normalizePhoneOrError,
  sanitizeMetadata,
  sanitizeVariables,
} from "@/lib/public-api/validation";
import { emitPublicApiEvent } from "@/lib/public-api/webhooks";

function toIso(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  if (typeof value === "object" && value && "toDate" in value && typeof (value as { toDate: () => Date }).toDate === "function") {
    try {
      return (value as { toDate: () => Date }).toDate().toISOString();
    } catch {
      return null;
    }
  }
  return null;
}

async function resolveTemplate(orgId: string, template: string | undefined, channel: "whatsapp" | "email") {
  const name = (template || "").trim();
  if (!name || usesNotificasDefaultTemplate(name) || name === WA_DEFAULT_TEMPLATE_NAME) {
    return { templateName: "", templateLang: "es_AR", templateVariables: [] as string[], urlButton: false, useDefault: true };
  }
  const snap = await getAdminDb().collection("wa_templates").where("orgId", "==", orgId).get();
  const match = snap.docs
    .map((d) => mapSavedWaTemplate(d.id, d.data() as Record<string, unknown>))
    .find(
      (t) =>
        t.id === name ||
        t.templateName.toLowerCase() === name.toLowerCase() ||
        t.label.toLowerCase() === name.toLowerCase()
    );
  if (!match) {
    if (channel === "email") return { templateName: "", templateLang: "es_AR", templateVariables: [] as string[], urlButton: false, useDefault: true };
    throw unprocessable("unknown_template", "The template is not available for this account.", "template");
  }
  return {
    templateName: match.templateName,
    templateLang: match.templateLang,
    templateVariables: match.templateVariables,
    urlButton: match.urlButton,
    useDefault: false,
  };
}

export async function createPublicBatch(ctx: PublicApiAuthContext, rawBody: unknown) {
  const parsed = createBatchSchema.safeParse(rawBody);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw invalidRequest("invalid_request", issue?.message || "Invalid request.", issue?.path.join(".") || undefined);
  }
  const input = parsed.data;
  if (input.recipients.length > MAX_BATCH_RECIPIENTS) {
    throw invalidRequest("too_many_recipients", `A batch cannot exceed ${MAX_BATCH_RECIPIENTS} recipients.`, "recipients");
  }

  const orgSnap = await getAdminDb().collection("organizations").doc(ctx.orgId).get();
  const org = orgSnap.data() || {};
  const planMax = maxRecipientsForPlan(String(org.plan || "starter"));
  if (input.recipients.length > planMax) {
    throw unprocessable("plan_limit", `This plan allows at most ${planMax} recipients per batch.`, "recipients");
  }

  const tpl = await resolveTemplate(ctx.orgId, input.template, input.channel);
  const allowlist = mergeAllowlist({
    phones: Array.isArray(org.apiSandboxAllowlist?.phones) ? org.apiSandboxAllowlist.phones.map(String) : [],
    emails: Array.isArray(org.apiSandboxAllowlist?.emails) ? org.apiSandboxAllowlist.emails.map(String) : [],
  });

  const recipients: RecipientEntry[] = [];
  for (let i = 0; i < input.recipients.length; i++) {
    const row = input.recipients[i];
    const vars = sanitizeVariables(row.variables);
    let phone: string | undefined;
    let email: string | undefined;
    if (input.channel === "whatsapp") {
      const n = normalizePhoneOrError(row.phone);
      if (!n.ok) throw invalidRequest("invalid_phone", `Recipient ${i} has an invalid phone number.`, `recipients.${i}.phone`);
      phone = n.phone;
      if (row.email) {
        if (!isValidEmail(row.email)) throw invalidRequest("invalid_email", `Recipient ${i} has an invalid email.`, `recipients.${i}.email`);
        email = row.email.trim().toLowerCase();
      }
    } else {
      if (!row.email || !isValidEmail(row.email)) {
        throw invalidRequest("invalid_email", `Recipient ${i} has an invalid email.`, `recipients.${i}.email`);
      }
      email = row.email.trim().toLowerCase();
      if (row.phone) {
        const n = normalizePhoneOrError(row.phone);
        if (!n.ok) throw invalidRequest("invalid_phone", `Recipient ${i} has an invalid phone number.`, `recipients.${i}.phone`);
        phone = n.phone;
      }
    }
    if (ctx.testMode && !isSandboxRecipientAllowed({ allowlist, phone, email })) {
      // sandbox batch: still accepted; campaign.simulated=true so CF no despacha
    }
    const nombre = row.name?.trim() || vars.nombre || "Destinatario";
    recipients.push({
      email: email && !isSyntheticCampaignEmail(email) ? email : `wa-${(phone || "").replace(/\D/g, "")}@notificas.internal`,
      nombre,
      telefono: phone,
      dni: (row.document || vars.dni || "").replace(/\D/g, "") || undefined,
      dias: vars.dias,
      fecha: vars.fecha,
      monto: vars.monto,
      cuotas: presentRecipientValue(vars.cuotas) ? recipientValueText(vars.cuotas) : undefined,
    });
  }

  const simulate = ctx.testMode && recipients.every((r) =>
    !isSandboxRecipientAllowed({ allowlist, phone: r.telefono, email: isSyntheticCampaignEmail(r.email) ? undefined : r.email })
  );

  const publicId = newBatchId(ctx.testMode);
  const canal: CanalCampaign = input.channel === "whatsapp" ? "whatsapp" : "email";
  const db = getAdminDb();
  const campRef = db.collection("campaigns").doc();
  const metadata = sanitizeMetadata(input.metadata as Record<string, string | number | boolean> | undefined);

  await campRef.set({
    orgId: ctx.orgId,
    createdBy: ctx.senderUid,
    senderUid: ctx.senderUid,
    senderEmail: ctx.senderEmail,
    nombre: `API batch ${publicId}`,
    asunto: input.subject || "Notificación",
    cuerpo: input.body || "",
    adjuntos: [],
    canal,
    estado: "borrador",
    recipientCount: recipients.length,
    recipientEmails: [],
    recipientData: [],
    stats: { total: recipients.length, enviados: 0, leidos: 0, pendientes: recipients.length, errores: 0 },
    createdAt: FieldValue.serverTimestamp(),
    apiSource: "public_api",
    publicApiBatchId: publicId,
    publicApiTestMode: ctx.testMode,
    apiKeyId: ctx.apiKeyId,
    apiReference: input.reference || null,
    apiMetadata: metadata,
    simulated: simulate,
    ...(tpl.useDefault
      ? {}
      : {
          waTemplateName: tpl.templateName,
          waTemplateLang: tpl.templateLang,
          waTemplateVariables: tpl.templateVariables,
          waUrlButton: tpl.urlButton,
        }),
  });

  await saveAllRecipientChunks(ctx.orgId, campRef.id, recipients);

  await db.collection(COLLECTIONS.apiBatches).doc(publicId).set({
    id: publicId,
    orgId: ctx.orgId,
    campaignId: campRef.id,
    channel: input.channel,
    status: "queued",
    total: recipients.length,
    reference: input.reference || null,
    testMode: ctx.testMode,
    apiKeyId: ctx.apiKeyId,
    createdAt: FieldValue.serverTimestamp(),
    requestId: ctx.requestId,
  });

  try {
    await startCampaignTanda({
      campaignId: campRef.id,
      actorUid: ctx.senderUid,
      actorEmail: ctx.senderEmail,
      requireStorage: true,
      chargeCredits: !simulate,
      maxRecipients: planMax,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not queue the batch.";
    const status = typeof (e as { status?: number }).status === "number" ? (e as { status: number }).status : 422;
    throw new PublicApiError({
      httpStatus: status === 404 ? 404 : 422,
      type: status === 404 ? "not_found" : "validation_error",
      code: "batch_queue_failed",
      message: msg,
    });
  }

  await emitPublicApiEvent({
    type: "notification.queued",
    orgId: ctx.orgId,
    environment: ctx.environment,
    data: { batch_id: publicId, status: "queued", total: recipients.length },
  }).catch(() => undefined);

  return {
    httpStatus: 201,
    body: {
      id: publicId,
      status: "queued",
      total: recipients.length,
      channel: input.channel,
      ...(ctx.testMode ? { test_mode: true } : {}),
    },
  };
}

export async function getPublicBatch(ctx: PublicApiAuthContext, id: string) {
  const snap = await getAdminDb().collection(COLLECTIONS.apiBatches).doc(id).get();
  if (!snap.exists) throw notFound("batch_not_found", "Batch not found.");
  const data = snap.data()!;
  assertTenant(String(data.orgId || ""), ctx.orgId);
  if (Boolean(data.testMode) !== ctx.testMode) throw notFound("batch_not_found", "Batch not found.");

  const campaignId = String(data.campaignId || "");
  const campSnap = await getAdminDb().collection("campaigns").doc(campaignId).get();
  const camp = campSnap.data() || {};
  const stats = (camp.stats || {}) as {
    total?: number;
    enviados?: number;
    leidos?: number;
    pendientes?: number;
    errores?: number;
  };

  const db = getAdminDb();
  const [deliveredSnap, readSnap] = await Promise.all([
    db.collection("campaign_messages").where("campaignId", "==", campaignId).where("waEstado", "==", "entregado").count().get(),
    db.collection("campaign_messages").where("campaignId", "==", campaignId).where("waEstado", "==", "leido").count().get(),
  ]);

  const total = typeof camp.recipientCount === "number" ? camp.recipientCount : Number(data.total || 0);
  const sent = typeof stats.enviados === "number" ? stats.enviados : 0;
  const failed = typeof stats.errores === "number" ? stats.errores : 0;
  const queued = typeof stats.pendientes === "number" ? stats.pendientes : Math.max(0, total - sent - failed);
  const delivered = deliveredSnap.data().count;
  const read = typeof stats.leidos === "number" && stats.leidos > 0 ? stats.leidos : readSnap.data().count;

  return {
    id,
    status: normalizeBatchStatus(camp.estado || data.status),
    total,
    queued,
    sent,
    delivered,
    read,
    failed,
    channel: data.channel || camp.canal || null,
    created_at: toIso(data.createdAt) || toIso(camp.createdAt),
    ...(data.testMode ? { test_mode: true } : {}),
  };
}
