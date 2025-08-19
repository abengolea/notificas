import { addDoc, collection } from 'firebase/firestore';
import { db } from './firebase';
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
  senderName?: string;
};

function normalizeList(value?: string | string[]) {
  const arr = Array.isArray(value) ? value : value ? [value] : [];
  return arr.map(v => v.trim()).filter(Boolean);
}

export async function scheduleEmail(params: ScheduleEmailParams): Promise<string> {
  const { to, subject, html, text, from, replyTo, cc, bcc, recipientName, recipientEmail, senderName } = params;

  const payload: any = {
    to: normalizeList(to),
    message: {
      subject,
      html,
      text: (text ?? html.replace(/<[^>]*>/g, '')) || ''
    }
  };

  // Agregar campos para el template personalizado
  if (recipientName) payload.recipientName = recipientName;
  if (recipientEmail) payload.recipientEmail = recipientEmail;
  if (senderName) payload.senderName = senderName;

  const fromNorm = from?.trim();
  const replyToNorm = replyTo?.trim();
  const ccNorm = normalizeList(cc);
  const bccNorm = normalizeList(bcc);

  if (fromNorm) payload.from = fromNorm;
  if (replyToNorm) payload.replyTo = replyToNorm;
  if (ccNorm.length) payload.cc = ccNorm;
  if (bccNorm.length) payload.bcc = bccNorm;

  const docRef = await addDoc(collection(db, 'mail'), payload);
  return docRef.id;
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
