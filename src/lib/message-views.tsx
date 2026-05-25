"use client";

import { escapeHtml } from "./inject-content-for-reader";
import { renderRichMessageContent } from "./rich-text";

export interface MailMessage {
  from?: string;
  to?: string | string[];
  message?: {
    subject?: string;
    html?: string;
    content?: string;
    details?: {
      fecha?: string;
      attachmentsCount?: number;
    };
  };
  senderName?: string;
  recipientEmail?: string;
  createdBy?: string;
  delivery?: { state?: string; time?: unknown };
  tracking?: { sentAt?: unknown };
  attachments?: Array<{
    id: string;
    fileName: string;
    fileUrl: string;
    fileSize?: number;
    hash?: string;
  }>;
}

/**
 * Sanitiza el HTML para la vista del REMITENTE (dashboard).
 * Elimina botones "Acceder a la notificación", enlaces placeholder, etc.
 * El remitente solo ve el contenido sin CTAs de email.
 */
export function sanitizeHtmlForSender(html: string): string {
  if (!html) return "";

  // Eliminar botón "Acceder a la notificación"
  let out = html.replace(
    /<p[^>]*>\s*<a[^>]*class="btn"[^>]*>[\s]*Acceder a la notificaci[oó]n[\s]*<\/a>\s*<\/p>/gi,
    ""
  );

  // Eliminar sección "Si el botón no funciona..."
  out = out.replace(
    /<p[^>]*class="muted"[^>]*>[\s]*Si el boton no funciona[^<]*<br[^>]*>[\s]*<a[^>]*>\[[^\]]*\][^<]*<\/a>[\s]*<\/p>/gi,
    ""
  );

  // Eliminar enlace placeholder si quedó suelto
  out = out.replace(
    /<a[^>]*>\[El enlace se agregar[^<]*<\/a>/gi,
    ""
  );

  // Eliminar div con clase divider antes del footer (opcional, para limpieza)
  return out;
}

/**
 * Genera HTML limpio para la vista del REMITENTE.
 * Solo muestra: contenido del mensaje, detalles, adjuntos.
 * Sin plantilla de email ni botones.
 */
export function buildSenderViewHtml(mail: MailMessage): string {
  const content =
    mail?.message?.content?.trim() || extractBodyFromMailHtml(mail?.message?.html || "") || "";
  const details = mail?.message?.details;
  const attachments = mail?.attachments || [];

  let html = "";

  if (content) {
    const contentHtml = renderRichMessageContent(content);
    html += `
    <div class="mb-6">
      <h3 class="text-sm font-semibold text-muted-foreground mb-2">Contenido del mensaje</h3>
      <div class="rounded-lg border border-border bg-muted/30 p-4">
        <div class="rich-message-content text-sm leading-6">${contentHtml}</div>
      </div>
    </div>`;
  }

  if (details) {
    html += `
    <div class="mb-6">
      <h3 class="text-sm font-semibold text-muted-foreground mb-2">Detalles del envío</h3>
      <ul class="text-sm space-y-1 text-muted-foreground">
        <li>Fecha: <strong class="text-foreground">${escapeHtml(details.fecha || "-")}</strong></li>
        ${(details.attachmentsCount || 0) > 0 ? `<li>Adjuntos: <strong class="text-foreground">${details.attachmentsCount} archivo(s)</strong></li>` : ""}
      </ul>
    </div>`;
  }

  if (attachments.length > 0) {
    html += `
    <div class="mb-6">
      <h3 class="text-sm font-semibold text-muted-foreground mb-2">Documentos adjuntos</h3>
      <ul class="space-y-2">
        ${attachments
          .map(
            (a) =>
              `<li class="text-sm flex items-center gap-2">
                <a href="${a.fileUrl}" target="_blank" rel="noopener" class="text-primary hover:underline">${escapeHtml(a.fileName)}</a>
                ${a.hash ? `<span class="text-xs text-muted-foreground">(hash verificado)</span>` : ""}
              </li>`
          )
          .join("")}
      </ul>
    </div>`;
  }

  return html || '<p class="text-muted-foreground text-sm">Sin contenido adicional.</p>';
}

/**
 * Preferir el bloque del cuerpo en la plantilla (div.message-content), igual que en /reader/[id].
 * Evita meter en el cuadro toda la letra legal y cabeceras del email si falta message.content.
 */
function extractBodyFromMailHtml(html: string): string {
  if (!html) return "";
  const match =
    html.match(/class="message-content"[\s\S]*?<div[^>]*>([\s\S]*?)<\/div>\s*<\/div>/i) ||
    html.match(/<div[^>]*message-content[^>]*>([\s\S]*?)<\/div>/i);
  if (match?.[1]) {
    const inner = match[1];
    return inner.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  }
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
