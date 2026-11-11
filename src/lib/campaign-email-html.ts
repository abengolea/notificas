import type { CampaignAttachment } from '@/lib/types';
import {
  messageDisclaimer,
  messageKindCopy,
  messageKindPreviewFallback,
  type MessageKind,
} from '@/lib/message-kind';

export function escapeHtmlText(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export type CampaignPersonalizeRow = {
  nombre?: string;
  dni?: string;
  legajo?: string;
  email?: string;
  telefono?: string;
  dias?: string;
  fecha?: string;
  monto?: string;
  cuotas?: string;
  area?: string;
};

/** Sustituye {{nombre}}, {{dni}}, {{legajo}}, {{fecha}}, {{monto}}, … en texto (asunto o cuerpo). */
export function personalizeCampaignText(
  template: string,
  row: CampaignPersonalizeRow
): string {
  const vals: Record<string, string> = {
    nombre: row.nombre || '',
    dni: row.dni ?? '',
    legajo: row.legajo ?? '',
    email: row.email ?? '',
    telefono: row.telefono ?? '',
    dias: row.dias ?? '',
    fecha: row.fecha ?? '',
    monto: row.monto ?? '',
    cuotas: row.cuotas ?? '',
    area: row.area ?? '',
  };
  return template.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (full, raw: string) => {
    const key = String(raw || '').toLowerCase();
    const mapped = key === 'dias_atraso' ? 'dias' : key;
    return Object.prototype.hasOwnProperty.call(vals, mapped) ? vals[mapped] : full;
  });
}

/** Si el cuerpo no parece HTML, convierte saltos de línea en párrafos escapados. */
export function campaignBodyToHtmlFragment(body: string): string {
  const t = body.trim();
  if (!t) return '';
  if (/<[a-z][\s\S]*>/i.test(t)) {
    return t;
  }
  return t
    .split('\n')
    .map((line) => `<p style="margin:0 0 8px 0;line-height:1.6;color:#334155;">${escapeHtmlText(line)}</p>`)
    .join('');
}

/**
 * Enlace del pie del correo. Es la portada del sitio: el seguimiento de enlaces (functions/tracking-html.js)
 * lo deja pasar sin registrarlo, porque entrar a la web no es acceder al mensaje.
 */
export const SITE_URL = 'https://notificas.com.ar';

/**
 * teaser: aviso con botón al lector. inline/letter: texto visible junto al botón al lector.
 * direct: texto completo en el correo y ningún enlace al lector (campañas mixtas sin lector en el correo).
 */
export type CampaignMailHtmlMode = 'teaser' | 'inline' | 'letter' | 'direct';

/** Campañas (email o mixta): Gmail es un sobre; la carta vive en el lector. */
export const CAMPAIGN_MAILBOX_MODE: CampaignMailHtmlMode = 'teaser';

export function buildCampaignMailHtml(params: {
  recipientEmail: string;
  recipientName: string;
  sender: string;
  bodyHtml: string;
  attachments: CampaignAttachment[];
  /** inline: 1:1. letter: carta visible en Gmail. teaser: campañas — solo enlace al lector. */
  mode?: CampaignMailHtmlMode;
  /** Vista previa en bandeja; si falta, se usa un texto genérico (sin jerga legal). */
  previewText?: string;
  /** Cómo se nombra el mensaje (notificación, comunicación, intimación). Por defecto, notificación. */
  kind?: MessageKind;
}): string {
  const { recipientName, sender, bodyHtml, attachments } = params;
  const kindCopy = messageKindCopy(params.kind);
  const disclaimer = messageDisclaimer(params.kind);
  const isDirect = params.mode === 'direct';
  const showBodyInMailbox = params.mode === 'inline' || params.mode === 'letter' || isDirect;
  /** Inline = el cuerpo de Meta va igual al mail y al lector; sin sobre ni carta gemela. */
  const skipLead = params.mode === 'inline';

  const hasInlineBody = !!(bodyHtml?.trim());
  const leadSecondParagraph = params.mode === 'letter' && hasInlineBody
    ? `Recibió una ${kindCopy.noun} de <strong>${escapeHtmlText(sender)}</strong>.
                Puede leer el texto completo en este mismo correo. El enlace registra la apertura y es el mismo acceso que le enviamos por WhatsApp.`
    : `<strong>${escapeHtmlText(sender)}</strong> le envió una ${kindCopy.noun}.`;

  const previewRaw = String(params.previewText || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 140);
  const preview = previewRaw
    || messageKindPreviewFallback(params.kind, sender);

  const hideAttr = showBodyInMailbox ? '' : ' data-email-hide';
  const contentSection = bodyHtml?.trim()
    ? `
                <div class="message-content"${hideAttr} style="margin: 20px 0;">
                  <div style="background: #f8fafc; padding: 16px; border-radius: 6px; border-left: 4px solid #0D9488;">
                    ${bodyHtml}
                  </div>
                </div>`
    : '';

  const attachmentsSection =
    attachments.length > 0
      ? `
                <div data-email-hide style="margin-bottom: 20px;">
                    <h2 style="color: #1e293b; margin: 0 0 16px 0; font-size: 18px; font-weight: 600;">📎 Documentos adjuntos (${attachments.length}):</h2>
                    <div style="background: #f8fafc; padding: 16px; border-radius: 6px; border-left: 4px solid #0D9488;">
                        ${attachments
                          .map(
                            (file) => `
                            <div style="margin-bottom: 12px; padding: 12px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 6px;">
                                <div style="display: flex; align-items: center; gap: 12px;">
                                    <div style="width: 40px; height: 40px; background: #dc2626; border-radius: 6px; display: flex; align-items: center; justify-content: center;">
                                        <span style="color: white; font-weight: bold; font-size: 12px;">${escapeHtmlText(String(file.nombre.split('.').pop() || 'DOC').toUpperCase())}</span>
                                    </div>
                                    <div style="flex: 1;">
                                        <h4 style="margin: 0 0 4px 0; color: #1e293b; font-size: 14px; font-weight: 600;">${escapeHtmlText(file.nombre)}</h4>
                                        <p style="margin: 0; color: #64748b; font-size: 12px;">${(file.size / 1024).toFixed(1)} KB • Con hash de integridad</p>
                                    </div>
                                    <a href="${escapeHtmlText(file.url)}"
                                       style="background: #0D9488; color: white; padding: 8px 16px; border-radius: 6px; text-decoration: none; font-size: 12px; font-weight: 600; display: inline-block;">
                                        Ver documento
                                    </a>
                                </div>
                                ${
                                  file.hash
                                    ? `
                                    <div style="margin-top: 8px; padding: 8px; background: #f0f9ff; border-radius: 4px; border: 1px solid #0ea5e9;">
                                        <p style="margin: 0; color: #0c4a6e; font-size: 11px; font-family: monospace; word-break: break-all;">
                                            <strong>Hash SHA-256:</strong> ${escapeHtmlText(file.hash)}
                                        </p>
                                    </div>`
                                    : ''
                                }
                            </div>
                        `
                          )
                          .join('')}
                    </div>
                </div>`
      : '';

  const year = new Date().getFullYear();
  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>Nueva ${kindCopy.noun} digital</title>
  <style>
    body, table, td, a { font-family: "Inter", -apple-system, Segoe UI, Roboto, Arial, sans-serif !important; }
    body { margin: 0; padding: 0; background-color: #F8FAFC; color: #1E293B; }
    .wrapper { width: 100%; table-layout: fixed; background-color: #F8FAFC; padding: 24px 0; }
    .container { width: 100%; max-width: 800px; background: #ffffff; margin: 0 auto; border-radius: 8px; overflow: hidden; border: 1px solid #E2E8F0; }
    .header { background: #0D9488; color: #ffffff; padding: 20px 24px; }
    .badge { display: inline-block; background: #1E3A8A; color: #fff; font-size: 12px; letter-spacing: .4px; padding: 4px 8px; border-radius: 999px; }
    .title { margin: 10px 0 0 0; font-size: 20px; line-height: 1.3; font-weight: 700; }
    .content { padding: 24px; }
    .lead { font-size: 16px; line-height: 1.6; margin: 0 0 16px 0; }
    .btn { display: inline-block; background: #0D9488; color: #ffffff !important; text-decoration: none; padding: 12px 20px; border-radius: 8px; font-weight: 700; }
    .muted { color: #64748B; font-size: 12px; line-height: 1.6; }
    .divider { height: 1px; background: #E2E8F0; margin: 20px 0; }
    .footer { padding: 16px 24px 24px; }
  </style>
</head>
<body>
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
    ${escapeHtmlText(preview)}
  </div>
  <table role="presentation" class="wrapper" width="100%" cellspacing="0" cellpadding="0">
    <tr>
      <td align="center">
        <table role="presentation" class="container" cellspacing="0" cellpadding="0">
          <tr>
            <td class="header">
              <span class="badge">${kindCopy.badge}</span>
              <div class="title">${escapeHtmlText(sender)}</div>
            </td>
          </tr>
          <tr>
            <td class="content">
              ${skipLead ? '' : `<p class="lead">Estimado/a ${escapeHtmlText(recipientName)},</p>
              <p class="lead">
                ${leadSecondParagraph}
              </p>`}
              ${contentSection}
              ${attachmentsSection}
              ${
                isDirect
                  ? ''
                  : `<p style="margin: 20px 0 12px 0;">
                <a class="btn" href="#" target="_blank" rel="noopener">${kindCopy.button}</a>
              </p>
              <p class="muted">
                <a href="#" target="_blank" rel="noopener" style="color:inherit;">[El enlace se agregará al enviar el mensaje]</a>
              </p>`
              }
              <p class="muted notice-disclaimer" style="margin-top:16px;">
                ${
                  isDirect
                    ? `<strong>Importante:</strong> este correo contiene una ${kindCopy.noun}. El envío queda registrado.`
                    : `<strong>${disclaimer.lead}</strong>${escapeHtmlText(disclaimer.body)}`
                }
              </p>
            </td>
          </tr>
          <tr>
            <td class="footer">
              <div class="muted">
                ${year} Notificas.com · <a href="${SITE_URL}" target="_blank" rel="noopener" style="color:inherit;">Visitar nuestra web</a>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Igual que `sendEmail`: `$('[data-email-hide]').remove()`.
 * El wizard no puede pintar el HTML crudo: el atributo no oculta nada en el navegador.
 */
export function stripMailboxHiddenHtml(html: string): string {
  if (!html || !html.includes('data-email-hide')) return html;
  return removeDivsWithAttr(html, 'data-email-hide');
}

function removeDivsWithAttr(html: string, attr: string): string {
  const openRe = new RegExp(`<div\\b[^>]*\\b${attr}\\b[^>]*>`, 'i');
  let out = html;
  for (;;) {
    const match = openRe.exec(out);
    if (!match) break;
    const start = match.index;
    let depth = 1;
    let i = start + match[0].length;
    const lower = out.toLowerCase();
    while (i < out.length && depth > 0) {
      const nextOpen = lower.indexOf('<div', i);
      const nextClose = lower.indexOf('</div>', i);
      if (nextClose < 0) break;
      if (nextOpen >= 0 && nextOpen < nextClose) {
        depth += 1;
        i = nextOpen + 4;
      } else {
        depth -= 1;
        i = nextClose + 6;
      }
    }
    out = `${out.slice(0, start)}${out.slice(i)}`;
    openRe.lastIndex = 0;
  }
  return out;
}
