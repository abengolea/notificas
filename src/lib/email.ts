import { addDoc, collection, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
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
  recipientPhone?: string; // Teléfono para enviar WhatsApp
  senderName?: string;
  createdBy?: string; // UID del usuario que envía (para certificación Polygon)
};

function normalizeList(value?: string | string[]) {
  const arr = Array.isArray(value) ? value : value ? [value] : [];
  return arr.map(v => v.trim()).filter(Boolean);
}

export async function scheduleEmail(params: ScheduleEmailParams & { skipAutoSend?: boolean }): Promise<string> {
  const { to, subject, html, text, from, replyTo, cc, bcc, recipientName, recipientEmail, recipientPhone, senderName, createdBy, skipAutoSend = false } = params;

  console.log('📧 scheduleEmail called with:', { to, subject, recipientEmail, senderName, skipAutoSend });
  console.log('📧 Stack trace:', new Error().stack);

  const payload: any = {
    to: normalizeList(to),
    message: {
      subject,
      html,
      text: (text ?? html.replace(/<[^>]*>/g, '')) || ''
    },
    // 🕐 TIMESTAMP ÚNICO PARA CADA DOCUMENTO
    createdAt: serverTimestamp(),
    timestamp: new Date().toISOString()
  };

  console.log('📧 Payload created:', { to: payload.to, subject: payload.message.subject, recipientEmail, senderName });

  // Agregar campos para el template personalizado
  if (recipientName) payload.recipientName = recipientName;
  if (recipientEmail) payload.recipientEmail = recipientEmail;
  if (recipientPhone) payload.recipientPhone = recipientPhone;
  if (senderName) payload.senderName = senderName;
  if (createdBy) payload.createdBy = createdBy;

  // 🚨 ID ÚNICO PARA EVITAR DUPLICADOS
  const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
  payload.uniqueId = uniqueId;

  const fromNorm = from?.trim();
  const replyToNorm = replyTo?.trim();
  const ccNorm = normalizeList(cc);
  const bccNorm = normalizeList(bcc);

  if (fromNorm) payload.from = fromNorm;
  if (replyToNorm) payload.replyTo = replyToNorm;
  if (ccNorm.length) payload.cc = ccNorm;
  if (bccNorm.length) payload.bcc = bccNorm;

  // 🚨 VERIFICAR DUPLICADOS ANTES DE CREAR
  console.log('📧 Checking for duplicates with uniqueId:', uniqueId);
  
  // TEMPORALMENTE DESHABILITADO - Error de índice de Firestore
  // TODO: Crear índice o usar otra estrategia
  console.log('⚠️ Verificación de duplicados deshabilitada temporalmente');
  
  const docRef = await addDoc(collection(db, 'mail'), payload);
  console.log('📧 Document created with ID:', docRef.id);
  
  // 🚀 LLAMAR AL ENDPOINT HTTP PARA ENVIAR EL EMAIL (solo si skipAutoSend es false)
  if (!skipAutoSend) {
    try {
      const timestamp = new Date().toISOString();
      console.log(`🌐 [${timestamp}] Llamando a /api/sendEmail con docId:`, docRef.id);
      const response = await fetch('/api/sendEmail', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ docId: docRef.id })
      });
      console.log(`🌐 [${timestamp}] Respuesta de /api/sendEmail:`, response.status, response.statusText);
      
      if (!response.ok) {
        console.error('❌ Error al enviar email:', response.statusText);
      } else {
        const result = await response.json();
        console.log('✅ Email enviado exitosamente:', result);
      }
    } catch (error) {
      console.error('❌ Error al llamar endpoint sendEmail:', error);
    }
  } else {
    console.log('⏭️ Auto-envío deshabilitado (skipAutoSend=true), se debe llamar manualmente a sendEmail');
  }
  
  return docRef.id;
}

export type SendEmailResult = { success: boolean; whatsappId?: string; whatsappError?: string };

// Función helper para enviar el email manualmente después de actualizar el documento
export async function sendEmailManually(docId: string): Promise<SendEmailResult> {
  const timestamp = new Date().toISOString();
  console.log(`🌐 [${timestamp}] Llamando manualmente a /api/sendEmail con docId:`, docId);
  const response = await fetch('/api/sendEmail', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ docId })
  });
  console.log(`🌐 [${timestamp}] Respuesta de /api/sendEmail:`, response.status, response.statusText);
  
  const result = await response.json();
  if (!response.ok) {
    console.error('❌ Error al enviar email:', result);
    throw new Error(result?.error || `Error al enviar email: ${response.status}`);
  }
  console.log('✅ Email enviado:', result);
  return result;
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
