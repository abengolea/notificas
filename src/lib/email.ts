import { addDoc, collection, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { db, auth } from './firebase';
import { generateEmailHtml } from './email-template';

export type ScheduleEmailParams = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
  cc?: string | string[];
  bcc?: string | string[];
  recipientName?: string;
  recipientEmail?: string;
  recipientPhone?: string; // Teléfono para enviar WhatsApp
  senderName?: string;
  createdBy?: string; // UID del usuario que envía (para certificación Polygon)
};

/** Lista de correos para `to`, `cc`, `bcc`: minúsculas + trim (alineado con queries y reglas). */
function normalizeEmailList(value?: string | string[]) {
  const arr = Array.isArray(value) ? value : value ? [value] : [];
  return arr.map((v) => v.trim().toLowerCase()).filter(Boolean);
}

/** Campos opcionales que a veces son email y otras un nombre visible (p. ej. encabezado From). */
function normalizedEmailIdentity(value?: string): string | undefined {
  const t = value?.trim();
  if (!t) return undefined;
  return t.includes('@') ? t.toLowerCase() : t;
}

export async function scheduleEmail(params: ScheduleEmailParams & { skipAutoSend?: boolean }): Promise<string> {
  const { to, subject, html, text, from, replyTo, cc, bcc, recipientName, recipientEmail, recipientPhone, senderName, createdBy, skipAutoSend = false } = params;

  const payload: any = {
    to: normalizeEmailList(to),
    message: {
      subject,
      html,
      text: (text ?? html.replace(/<[^>]*>/g, '')) || ''
    },
    // 🕐 TIMESTAMP ÚNICO PARA CADA DOCUMENTO
    createdAt: serverTimestamp(),
    timestamp: new Date().toISOString()
  };

  // Agregar campos para el template personalizado
  if (recipientName) payload.recipientName = recipientName;
  // recipientEmail siempre se guarda — es el campo que usa el inbox para query ==.
  // Si no se pasa explícitamente, se deriva del primer email del campo `to`.
  const recNorm = normalizedEmailIdentity(recipientEmail) ?? payload.to[0] ?? '';
  if (recNorm) payload.recipientEmail = recNorm;
  if (recipientPhone) payload.recipientPhone = recipientPhone;
  const sendNorm = normalizedEmailIdentity(senderName);
  if (sendNorm) payload.senderName = sendNorm;
  if (createdBy) payload.createdBy = createdBy;

  // 🚨 ID ÚNICO PARA EVITAR DUPLICADOS
  const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
  payload.uniqueId = uniqueId;

  const fromNorm = normalizedEmailIdentity(from);
  const replyToNorm = normalizedEmailIdentity(replyTo);
  const ccNorm = normalizeEmailList(cc);
  const bccNorm = normalizeEmailList(bcc);

  if (fromNorm) payload.from = fromNorm;
  if (replyToNorm) payload.replyTo = replyToNorm;
  if (ccNorm.length) payload.cc = ccNorm;
  if (bccNorm.length) payload.bcc = bccNorm;

  const docRef = await addDoc(collection(db, 'mail'), payload);
  
  if (!skipAutoSend) {
    try {
      const response = await fetch('/api/sendEmail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ docId: docRef.id })
      });
      if (!response.ok) {
        console.error('Error al enviar email:', response.statusText);
      }
    } catch (error) {
      console.error('Error al llamar endpoint sendEmail:', error);
    }
  }
  
  return docRef.id;
}

export type SendEmailResult = { success: boolean; whatsappId?: string; whatsappError?: string };

const SEND_EMAIL_TIMEOUT_MS = 60_000;
const GET_TOKEN_TIMEOUT_MS = 15_000;

function withTimeout<T>(promise: Promise<T>, ms: number, msg: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(msg)), ms);
    }),
  ]).finally(() => clearTimeout(timer!));
}

export async function sendEmailManually(docId: string): Promise<SendEmailResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SEND_EMAIL_TIMEOUT_MS);

  try {
    const token = await withTimeout(
      auth.currentUser?.getIdToken() ?? Promise.resolve(undefined),
      GET_TOKEN_TIMEOUT_MS,
      'No se pudo obtener el token de autenticación. Revisa tu conexión.',
    );

    const response = await fetch('/api/sendEmail', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ docId }),
      signal: controller.signal,
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result?.error || `Error al enviar email: ${response.status}`);
    }
    return result;
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('El envío tardó demasiado. Por favor, revisa tu conexión e intenta de nuevo.');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// Función helper para enviar emails de notificación usando el template
export async function sendNotificationEmail(params: {
  to: string | string[];
  senderName: string;
  recipientName: string;
  recipientEmail: string;
  subject?: string;
  from?: string;
  replyTo?: string;
}) {
  const { to, senderName, recipientName, recipientEmail, subject, from, replyTo } = params;
  
  // Generar el HTML usando el template
  const html = generateEmailHtml({
    senderName,
    recipientName,
    recipientEmail,
    readUrl: '', // Se llenará en Firebase Functions
    fallbackUrl: '', // Se llenará en Firebase Functions
    year: new Date().getFullYear()
  });

  // Enviar el email
  return scheduleEmail({
    to,
    subject: subject || 'Nueva notificación digital',
    html,
    from: from || 'contacto@notificas.com',
    replyTo,
    recipientName,
    recipientEmail
  });
}
