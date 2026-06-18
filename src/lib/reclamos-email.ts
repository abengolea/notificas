import { createMailDocumentAdmin } from "@/lib/email-server";
import {
  DEFAULT_CONTACT_FROM_EMAIL,
  getReclamosCreatedBy,
  getReclamosNotifyEmail,
} from "@/lib/mail-defaults";
import { escapeHtml } from "@/lib/reclamos";
import { invokeSendEmail } from "@/lib/send-mail-via-cf";

type ReclamoEmailData = {
  ticketNumber: string;
  nombre: string;
  email: string;
  telefono?: string;
  mensaje: string;
};

export async function sendReclamoNotifyAdmin(
  data: ReclamoEmailData,
): Promise<{ ok: boolean; docId?: string; error?: string }> {
  const notifyEmail = getReclamosNotifyEmail();
  const createdBy = getReclamosCreatedBy();

  const html = [
    `<p>Se registró un <strong>nuevo reclamo</strong> en Notificas.</p>`,
    `<p><strong>N° de ticket:</strong> ${escapeHtml(data.ticketNumber)}</p>`,
    `<p><strong>Nombre:</strong> ${escapeHtml(data.nombre)}</p>`,
    `<p><strong>Email:</strong> <a href="mailto:${escapeHtml(data.email)}">${escapeHtml(data.email)}</a></p>`,
    data.telefono
      ? `<p><strong>Teléfono:</strong> ${escapeHtml(data.telefono)}</p>`
      : "",
    `<p><strong>Mensaje:</strong></p>`,
    `<pre style="white-space:pre-wrap;font-family:inherit">${escapeHtml(data.mensaje)}</pre>`,
    `<p style="color:#666;font-size:12px">Gestionar en: ${escapeHtml(
      process.env.NEXT_PUBLIC_APP_URL || "https://notificas.com.ar",
    )}/admin/tickets</p>`,
  ]
    .filter(Boolean)
    .join("\n");

  const text = [
    `Nuevo reclamo — Ticket ${data.ticketNumber}`,
    `Nombre: ${data.nombre}`,
    `Email: ${data.email}`,
    data.telefono ? `Teléfono: ${data.telefono}` : "",
    `\nMensaje:\n${data.mensaje}`,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const docId = await createMailDocumentAdmin({
      to: notifyEmail,
      from: DEFAULT_CONTACT_FROM_EMAIL,
      replyTo: data.email,
      subject: `[Reclamo ${data.ticketNumber}] ${data.nombre}`,
      html,
      text,
      senderName: data.nombre,
      recipientName: "Admin Notificas",
      recipientEmail: notifyEmail,
      createdBy,
      contactRequest: true,
    });

    const sent = await invokeSendEmail(docId);
    if (!sent.ok) {
      return { ok: false, docId, error: sent.error };
    }
    return { ok: true, docId };
  } catch (e) {
    console.error("sendReclamoNotifyAdmin:", e);
    return { ok: false, error: "Error al enviar notificación al admin" };
  }
}

export async function sendReclamoAckToCustomer(
  data: ReclamoEmailData,
): Promise<{ ok: boolean; docId?: string; error?: string }> {
  const createdBy = getReclamosCreatedBy();

  const html = [
    `<p>Hola ${escapeHtml(data.nombre)},</p>`,
    `<p>Recibimos tu reclamo y ya lo registramos en nuestro sistema.</p>`,
    `<p style="font-size:18px"><strong>Número de ticket: ${escapeHtml(data.ticketNumber)}</strong></p>`,
    `<p>Conservá este número para futuras consultas. Nos comprometemos a responder en un plazo de <strong>5 días hábiles</strong>.</p>`,
    `<p style="color:#666;font-size:12px;margin-top:24px">— Equipo Notificas<br>contacto@notificas.com</p>`,
  ].join("\n");

  const text = [
    `Hola ${data.nombre},`,
    "",
    "Recibimos tu reclamo y ya lo registramos en nuestro sistema.",
    "",
    `Número de ticket: ${data.ticketNumber}`,
    "",
    "Conservá este número para futuras consultas. Nos comprometemos a responder en un plazo de 5 días hábiles.",
    "",
    "— Equipo Notificas",
    "contacto@notificas.com",
  ].join("\n");

  try {
    const docId = await createMailDocumentAdmin({
      to: data.email,
      from: DEFAULT_CONTACT_FROM_EMAIL,
      replyTo: DEFAULT_CONTACT_FROM_EMAIL,
      subject: `Reclamo recibido — Ticket ${data.ticketNumber}`,
      html,
      text,
      senderName: "Notificas",
      recipientName: data.nombre,
      recipientEmail: data.email,
      createdBy,
      contactRequest: true,
    });

    const sent = await invokeSendEmail(docId);
    if (!sent.ok) {
      return { ok: false, docId, error: sent.error };
    }
    return { ok: true, docId };
  } catch (e) {
    console.error("sendReclamoAckToCustomer:", e);
    return { ok: false, error: "Error al enviar acuse al cliente" };
  }
}
