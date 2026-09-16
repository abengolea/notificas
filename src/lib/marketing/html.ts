import { marketingClickUrl, marketingOpenUrl, marketingUnsubUrl } from "./tokens";

const MERGE_KEYS = ["nombre", "empresa", "pais", "cargo", "email"] as const;

export type MergeFields = {
  nombre: string;
  empresa: string;
  pais: string;
  cargo: string;
  email: string;
};

export function applyMergeFields(template: string, fields: MergeFields): string {
  return template.replace(/\{\{\s*([a-zA-Z_]+)\s*\}\}/g, (full, key: string) => {
    const k = key.toLowerCase();
    if ((MERGE_KEYS as readonly string[]).includes(k)) {
      return fields[k as keyof MergeFields] || "";
    }
    return full;
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function wrapHref(href: string, sendId: string): string {
  const trimmed = href.trim();
  if (!/^https?:\/\//i.test(trimmed)) return href;
  if (trimmed.includes("/api/marketing/")) return href;
  return marketingClickUrl(sendId, trimmed);
}

export function wrapTrackedLinks(html: string, sendId: string): string {
  return html.replace(/\bhref\s*=\s*(["'])(.*?)\1/gi, (_m, quote: string, href: string) => {
    return `href=${quote}${wrapHref(href, sendId)}${quote}`;
  });
}

export function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export function assembleMarketingHtml(input: {
  bodyHtml: string;
  sendId: string;
  contactId: string;
  fields: MergeFields;
}): { html: string; text: string } {
  const merged = applyMergeFields(input.bodyHtml, input.fields);
  const tracked = wrapTrackedLinks(merged, input.sendId);
  const openUrl = marketingOpenUrl(input.sendId);
  const unsubUrl = marketingUnsubUrl(input.contactId);
  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:Georgia,'Times New Roman',serif;color:#1f2a33;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f6f8;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%;background:#ffffff;border:1px solid #d9e1e6;">
          <tr>
            <td style="padding:28px 32px 8px;font-size:13px;letter-spacing:0.08em;text-transform:uppercase;color:#3a7d82;font-family:system-ui,sans-serif;">Notificas</td>
          </tr>
          <tr>
            <td style="padding:8px 32px 32px;font-size:16px;line-height:1.6;">${tracked}</td>
          </tr>
          <tr>
            <td style="padding:16px 32px 24px;border-top:1px solid #e6ecef;font-family:system-ui,sans-serif;font-size:12px;line-height:1.5;color:#5b6b75;">
              Enviado por Notificas · contacto@notificas.com.ar
              <br />
              <a href="${escapeHtml(unsubUrl)}" style="color:#5b6b75;">Darse de baja de estos correos</a>
            </td>
          </tr>
        </table>
        <img src="${escapeHtml(openUrl)}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0;" />
      </td>
    </tr>
  </table>
</body>
</html>`;
  const text = `${htmlToText(merged)}\n\n—\nNotificas · contacto@notificas.com.ar\nBaja: ${unsubUrl}`;
  return { html, text };
}
