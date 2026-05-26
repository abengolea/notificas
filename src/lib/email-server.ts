import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase-admin';
import type { CampaignAttachment } from '@/lib/types';

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
  senderName?: string;
  createdBy: string;
  campaignId?: string;
  campaignMessageId?: string;
  attachments?: CampaignAttachment[];
  /** Si true, la Cloud Function sendEmail envía correo simple (p. ej. formulario web). */
  contactRequest?: boolean;
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
    senderName,
    createdBy,
    campaignId,
    campaignMessageId,
    attachments,
    contactRequest,
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

  await mailRef.set(payload);
  return mailId;
}
