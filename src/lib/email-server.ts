import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase-admin';
import type { CampaignAttachment } from '@/lib/types';
import { presentRecipientValue, recipientValueText } from '@/lib/parse-campaign-csv';

function normalizeEmailList(value?: string | string[]) {
  const arr = Array.isArray(value) ? value : value ? [value] : [];
  return arr.map((v) => v.trim().toLowerCase()).filter(Boolean);
}

function normalizedEmailIdentity(value?: string): string | undefined {
  const t = value?.trim();
  if (!t) return undefined;
  return t.includes('@') ? t.toLowerCase() : t;
}

export type CreateMailAdminParams = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
  recipientName?: string;
  recipientEmail?: string;
  recipientPhone?: string;
  recipientDni?: string;
  recipientCuit?: string;
  recipientLegajo?: string;
  recipientDias?: string;
  recipientFecha?: string;
  recipientMonto?: string;
  recipientCuotas?: string;
  senderName?: string;
  createdBy: string;
  campaignId?: string;
  campaignMessageId?: string;
  attachments?: CampaignAttachment[];
  /** Si true, la Cloud Function sendEmail envía correo simple (p. ej. formulario web). */
  contactRequest?: boolean;
  // Template WhatsApp específico de la campaña
  waTemplateName?: string;
  waTemplateLang?: string;
  waTemplateVariables?: string[] | null;
  waUrlButton?: boolean;
  /** Campaña admin simulada: la CF sendEmail no debe despachar Mailgun/Meta. */
  simulated?: boolean;
  waOnly?: boolean;
  /** Campos de la API pública (opcional). No reemplazan createdBy/to/message. */
  orgId?: string;
  publicApiId?: string;
  apiSource?: string;
  apiKeyId?: string;
  apiReference?: string;
  apiMetadata?: Record<string, string>;
  apiChannel?: string;
  apiBatchId?: string;
  testMode?: boolean;
  requestId?: string;
  /** Cliente MCP (chatgpt/claude/otro). Solo metadato de evidencia. */
  mcpClient?: string;
};

/** Crea un documento en `mail` con Admin SDK (equivalente a scheduleEmail sin auto-fetch). */
export async function createMailDocumentAdmin(params: CreateMailAdminParams): Promise<string> {
  const {
    to,
    subject,
    html,
    text,
    from,
    replyTo,
    recipientName,
    recipientEmail,
    recipientPhone,
    recipientDni,
    recipientCuit,
    recipientLegajo,
    recipientDias,
    recipientFecha,
    recipientMonto,
    recipientCuotas,
    senderName,
    createdBy,
    campaignId,
    campaignMessageId,
    attachments,
    contactRequest,
    waTemplateName,
    waTemplateLang,
    waTemplateVariables,
    waUrlButton,
    simulated,
    waOnly,
    orgId,
    publicApiId,
    apiSource,
    apiKeyId,
    apiReference,
    apiMetadata,
    apiChannel,
    apiBatchId,
    testMode,
    requestId,
    mcpClient,
  } = params;

  const db = getAdminDb();
  const mailRef = db.collection('mail').doc();
  const mailId = mailRef.id;

  const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(7)}`;

  const messageObj: Record<string, unknown> = {
    subject,
    html,
    text: (text ?? html.replace(/<[^>]*>/g, '')) || '',
  };
  if (text) messageObj.contentText = text;

  if (attachments && attachments.length > 0) {
    messageObj.details = {
      fecha: new Date().toLocaleDateString('es-ES'),
      attachmentsCount: attachments.length,
      campaignId: campaignId ?? null,
    };
  }

  const payload: Record<string, unknown> = {
    to: normalizeEmailList(to),
    message: messageObj,
    createdAt: FieldValue.serverTimestamp(),
    timestamp: new Date().toISOString(),
    uniqueId,
  };

  if (recipientName) payload.recipientName = recipientName;
  const recNorm = normalizedEmailIdentity(recipientEmail);
  if (recNorm) payload.recipientEmail = recNorm;
  if (recipientPhone) payload.recipientPhone = recipientPhone;
  if (recipientDni) payload.recipientDni = recipientDni.replace(/\D/g, '');
  if (recipientCuit) payload.recipientCuit = recipientCuit.replace(/\D/g, '');
  if (recipientLegajo) payload.recipientLegajo = recipientLegajo;
  if (recipientDias) payload.recipientDias = recipientDias;
  if (recipientFecha) payload.recipientFecha = recipientFecha;
  if (recipientMonto) payload.recipientMonto = recipientMonto;
  if (presentRecipientValue(recipientCuotas)) payload.recipientCuotas = recipientValueText(recipientCuotas);
  if (waTemplateName) payload.waTemplateName = waTemplateName;
  if (waTemplateLang) payload.waTemplateLang = waTemplateLang;
  if (waTemplateVariables) payload.waTemplateVariables = waTemplateVariables;
  if (waUrlButton) payload.waUrlButton = true;
  const sendNorm = normalizedEmailIdentity(senderName);
  if (sendNorm) payload.senderName = sendNorm;
  payload.createdBy = createdBy;

  const fromNorm = normalizedEmailIdentity(from);
  const replyToNorm = normalizedEmailIdentity(replyTo);
  if (fromNorm) payload.from = fromNorm;
  if (replyToNorm) payload.replyTo = replyToNorm;

  if (campaignId) payload.campaignId = campaignId;
  if (campaignMessageId) payload.campaignMessageId = campaignMessageId;

  if (attachments && attachments.length > 0) {
    payload.attachments = attachments.map((file, index) => ({
      id: `${mailId}_${index}`,
      fileName: file.nombre,
      fileUrl: file.url,
      fileSize: file.size,
      uploadedAt: new Date(),
      hash: file.hash,
    }));
    payload.attachmentsHashes = attachments.map((f) => f.hash).filter(Boolean);
  }

  if (contactRequest) payload.contactRequest = true;
  if (simulated) payload.simulated = true;
  if (waOnly) payload.waOnly = true;
  if (orgId) payload.orgId = orgId;
  if (publicApiId) payload.publicApiId = publicApiId;
  if (apiSource) payload.apiSource = apiSource;
  if (apiKeyId) payload.apiKeyId = apiKeyId;
  if (apiReference) payload.apiReference = apiReference;
  if (apiMetadata && Object.keys(apiMetadata).length) payload.apiMetadata = apiMetadata;
  if (apiChannel) payload.apiChannel = apiChannel;
  if (apiBatchId) payload.apiBatchId = apiBatchId;
  if (testMode) payload.testMode = true;
  if (requestId) payload.requestId = requestId;
  if (mcpClient) payload.mcpClient = mcpClient;

  await mailRef.set(payload);
  return mailId;
}
