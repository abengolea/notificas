import { escapeHtml, renderRichMessageContent } from "./rich-text";

export { escapeHtml };

function replaceFirstMatchingDiv(
  html: string,
  predicate: (openTag: string) => boolean,
  replacement: string
): { html: string; replaced: boolean } {
  const openRe = /<div\b[^>]*>/gi;
  let match: RegExpExecArray | null = null;
  while ((match = openRe.exec(html))) {
    if (predicate(match[0])) break;
    match = null;
  }
  if (!match) return { html, replaced: false };

  const start = match.index;
  let depth = 1;
  let i = start + match[0].length;
  const lower = html.toLowerCase();
  while (i < html.length && depth > 0) {
    const nextOpen = lower.indexOf("<div", i);
    const nextClose = lower.indexOf("</div>", i);
    if (nextClose < 0) break;
    if (nextOpen >= 0 && nextOpen < nextClose) {
      depth += 1;
      i = nextOpen + 4;
    } else {
      depth -= 1;
      i = nextClose + 6;
    }
  }
  return { html: `${html.slice(0, start)}${replacement}${html.slice(i)}`, replaced: true };
}

function dropRemainingMessageContent(html: string): string {
  let out = html;
  for (let guard = 0; guard < 20; guard += 1) {
    const next = replaceFirstMatchingDiv(out, isMessageContentOpenTag, "");
    if (!next.replaced) break;
    out = next.html;
  }
  return out;
}

function isMessageContentOpenTag(openTag: string): boolean {
  const m = openTag.match(/\bclass\s*=\s*["']([^"']*)["']/i);
  if (!m) return false;
  return m[1].split(/\s+/).includes("message-content");
}

function buildReaderContentHtml(
  content: string,
  details?: { fecha?: string; attachmentsCount?: number }
): string {
  let contentHtml = "";
  if (content) {
    contentHtml += `<div style="margin: 20px 0;">
      <h2 style="color: #1e293b; margin: 0 0 16px 0; font-size: 18px; font-weight: 600;">Contenido del Mensaje:</h2>
      <div class="rich-message-content" style="background: #f8fafc; padding: 16px; border-radius: 6px; border-left: 4px solid #0D9488; line-height: 1.6; color: #334155;">
        ${renderRichMessageContent(content)}
      </div>
    </div>`;
  }
  if (details) {
    contentHtml += `<div style="background: #f1f5f9; padding: 16px; border-radius: 6px; border: 1px solid #e2e8f0; margin: 20px 0;">
      <h3 style="margin: 0 0 8px 0; color: #475569; font-size: 14px; font-weight: 600;">Detalles del Envío:</h3>
      <ul style="margin: 0; padding-left: 20px; color: #64748b; font-size: 13px;">
        <li>Fecha: <strong>${escapeHtml(details.fecha || "-")}</strong></li>
        ${(details.attachmentsCount || 0) > 0 ? `<li>Documentos adjuntos: <strong>${details.attachmentsCount} archivo(s) con hash de integridad</strong></li>` : ""}
      </ul>
    </div>`;
  }
  return contentHtml;
}

/**
 * El lector debe mostrar el texto lacrado (`message.content` / `contentText`),
 * no el globo de WhatsApp/Meta que a veces queda copiado en `message.html`.
 */
export function injectContentForReader(
  html: string,
  mail: {
    message?: {
      content?: string;
      contentText?: string;
      details?: { fecha?: string; attachmentsCount?: number };
    };
  }
): string {
  const content = String(mail?.message?.content || mail?.message?.contentText || "").trim();
  const details = mail?.message?.details;
  const contentHtml = buildReaderContentHtml(content, details);

  if (!html) return contentHtml;

  if (/<!--\s*CONTENT_PLACEHOLDER/i.test(html)) {
    return html.replace(/<!--\s*CONTENT_PLACEHOLDER[^>]*-->/i, contentHtml);
  }

  if (content) {
    const first = replaceFirstMatchingDiv(html, isMessageContentOpenTag, contentHtml);
    if (first.replaced) {
      return dropRemainingMessageContent(first.html);
    }
  }

  return html;
}
