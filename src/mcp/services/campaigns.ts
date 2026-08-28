import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { saveAllRecipientChunks } from "@/lib/campaign-recipients-storage";
import { maxRecipientsForPlan } from "@/lib/org-limits-client";
import { isSyntheticCampaignEmail, presentRecipientValue, recipientValueText } from "@/lib/parse-campaign-csv";
import { peekAvailableCredits, creditsRequiredForNotification } from "@/lib/public-api/notifications";
import { resolveOrgTemplate } from "@/lib/public-api/templates";
import { assertTenant } from "@/lib/public-api/tenant";
import { isValidEmail, normalizePhoneOrError, sanitizeMetadata } from "@/lib/public-api/validation";
import { normalizeBatchStatus } from "@/lib/public-api/status";
import type { CanalCampaign, RecipientEntry } from "@/lib/types";
import { mcpAppUrl, MAX_MCP_DRAFT_INLINE_RECIPIENTS } from "@/mcp/config";
import type { McpAuthContext } from "@/mcp/auth/context";
import { McpToolError } from "@/mcp/errors";
import { campaignIdSchema, createCampaignDraftSchema, parseOrThrow, requireEmail, requirePhone } from "@/mcp/tools/schemas";

function mapCampaignStatus(estado: unknown): string {
  const n = normalizeBatchStatus(estado);
  if (String(estado || "").toLowerCase() === "borrador") return "draft";
  if (n === "queued") return "draft";
  if (n === "cancelled") return "failed";
  return n;
}

export async function createCampaignDraft(ctx: McpAuthContext, raw: unknown) {
  const input = parseOrThrow(createCampaignDraftSchema, raw);
  if (input.recipients && input.recipients.length > MAX_MCP_DRAFT_INLINE_RECIPIENTS) {
    throw new McpToolError(
      "VALIDATION_ERROR",
      `Inline recipients cannot exceed ${MAX_MCP_DRAFT_INLINE_RECIPIENTS}. Use recipientListId for larger lists.`,
      400,
      "recipients"
    );
  }

  const db = getAdminDb();
  const orgSnap = await db.collection("organizations").doc(ctx.orgId).get();
  const org = orgSnap.data() || {};
  const planMax = maxRecipientsForPlan(String(org.plan || ctx.orgPlan || "starter"));

  let recipients: RecipientEntry[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];

  if (input.recipientListId) {
    const listSnap = await db.collection("recipient_lists").doc(input.recipientListId).get();
    if (!listSnap.exists) {
      throw new McpToolError("VALIDATION_ERROR", "Recipient list not found.", 404, "recipientListId");
    }
    const list = listSnap.data()!;
    try {
      assertTenant(String(list.orgId || ""), ctx.orgId);
    } catch {
      throw new McpToolError("VALIDATION_ERROR", "Recipient list not found.", 404, "recipientListId");
    }
    const rows = Array.isArray(list.recipients) ? list.recipients : [];
    recipients = rows.map((r: Record<string, unknown>) => ({
      email: String(r.email || ""),
      nombre: String(r.nombre || r.name || "Destinatario"),
      telefono: typeof r.telefono === "string" ? r.telefono : typeof r.phone === "string" ? r.phone : undefined,
      dni: typeof r.dni === "string" ? r.dni : undefined,
    }));
  } else if (input.recipients?.length) {
    for (let i = 0; i < input.recipients.length; i++) {
      const row = input.recipients[i];
      try {
        if (input.channel === "whatsapp") {
          const phone = requirePhone(row.phone || "");
          const email =
            row.email && isValidEmail(row.email)
              ? row.email.trim().toLowerCase()
              : `wa-${phone.replace(/\D/g, "")}@notificas.internal`;
          recipients.push({
            email,
            nombre: row.name || "Destinatario",
            telefono: phone,
            dni: row.document,
          });
        } else {
          const email = requireEmail(row.email || "");
          let phone: string | undefined;
          if (row.phone) {
            const n = normalizePhoneOrError(row.phone);
            if (n.ok) phone = n.phone;
          }
          recipients.push({
            email,
            nombre: row.name || "Destinatario",
            telefono: phone,
            dni: row.document,
          });
        }
      } catch (e) {
        errors.push(e instanceof Error ? `Recipient ${i}: ${e.message}` : `Recipient ${i} is invalid`);
      }
    }
  } else {
    throw new McpToolError(
      "VALIDATION_ERROR",
      "Provide recipients or recipientListId with a list already stored in Notificas.",
      400,
      "recipients"
    );
  }

  if (errors.length && recipients.length === 0) {
    throw new McpToolError("INVALID_RECIPIENT", errors.join(" "), 400);
  }
  if (recipients.length > planMax) {
    throw new McpToolError("VALIDATION_ERROR", `This plan allows at most ${planMax} recipients.`, 422, "recipients");
  }

  try {
    await resolveOrgTemplate(ctx.orgId, input.templateId, input.channel);
  } catch {
    throw new McpToolError("INVALID_TEMPLATE", "The template is not available for this account.", 422, "templateId");
  }

  const creditsNeeded = creditsRequiredForNotification(input.channel) * recipients.length;
  const creditsAvailable = await peekAvailableCredits(ctx.senderUid);
  if (creditsAvailable < creditsNeeded) {
    warnings.push("The account does not currently have enough credits to send this campaign from the web.");
  }
  warnings.push("This draft cannot be sent from MCP. Confirm and send it in the Notificas web app.");

  const canal: CanalCampaign = input.channel === "whatsapp" ? "whatsapp" : "email";
  const tpl = await resolveOrgTemplate(ctx.orgId, input.templateId, input.channel);
  const metadata = sanitizeMetadata(input.metadata as Record<string, string | number | boolean> | undefined);
  const campRef = db.collection("campaigns").doc();
  await campRef.set({
    orgId: ctx.orgId,
    createdBy: ctx.userId,
    senderUid: ctx.senderUid,
    senderEmail: ctx.senderEmail,
    nombre: input.name?.trim() || `MCP draft ${new Date().toISOString().slice(0, 10)}`,
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
    apiSource: "mcp",
    mcpClient: ctx.mcpClient,
    apiMetadata: { ...metadata, source: "mcp", client: ctx.mcpClient },
    ...(tpl.useDefault
      ? {}
      : {
          waTemplateName: tpl.templateName,
          waTemplateLang: tpl.templateLang,
          waTemplateVariables: tpl.templateVariables,
          waUrlButton: tpl.urlButton,
        }),
  });

  if (recipients.length) {
    await saveAllRecipientChunks(ctx.orgId, campRef.id, recipients.map((r) => ({
      ...r,
      email:
        r.email && !isSyntheticCampaignEmail(r.email)
          ? r.email
          : `wa-${String(r.telefono || "").replace(/\D/g, "")}@notificas.internal`,
      cuotas: presentRecipientValue(r.cuotas) ? recipientValueText(r.cuotas) : undefined,
    })));
  }

  const reviewUrl = `${mcpAppUrl()}/empresa/${ctx.orgId}/campanas/${campRef.id}`;
  return {
    campaignId: campRef.id,
    status: "draft",
    channel: input.channel,
    recipientCount: recipients.length,
    creditsNeeded,
    creditsAvailable,
    allowed_to_send_from_mcp: false,
    errors,
    warnings,
    review_url: reviewUrl,
  };
}

export async function getCampaignStatus(ctx: McpAuthContext, raw: unknown) {
  const { campaignId } = parseOrThrow(campaignIdSchema, raw);
  const snap = await getAdminDb().collection("campaigns").doc(campaignId).get();
  if (!snap.exists) throw new McpToolError("CAMPAIGN_NOT_FOUND", "Campaign not found.", 404);
  const data = snap.data()!;
  try {
    assertTenant(String(data.orgId || ""), ctx.orgId);
  } catch {
    throw new McpToolError("CAMPAIGN_NOT_FOUND", "Campaign not found.", 404);
  }
  const stats = (data.stats || {}) as {
    total?: number;
    enviados?: number;
    leidos?: number;
    pendientes?: number;
    errores?: number;
  };
  return {
    campaignId: snap.id,
    status: mapCampaignStatus(data.estado),
    channel: data.canal || null,
    name: data.nombre || null,
    recipientCount: typeof data.recipientCount === "number" ? data.recipientCount : stats.total || 0,
    metrics: {
      total: stats.total || 0,
      sent: stats.enviados || 0,
      read: stats.leidos || 0,
      pending: stats.pendientes || 0,
      errors: stats.errores || 0,
    },
    review_url: `${mcpAppUrl()}/empresa/${ctx.orgId}/campanas/${snap.id}`,
  };
}
