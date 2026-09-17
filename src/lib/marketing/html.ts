import { marketingClickUrl, marketingOpenUrl, marketingUnsubUrl } from "./tokens";
import { marketingContactEmail } from "./types";

const MERGE_KEYS = ["nombre", "empresa", "pais", "cargo", "email"] as const;

/** Hosted brand assets for inbox clients (never localhost). */
export const MARKETING_ASSET_ORIGIN = "https://notificas.com.ar";
export const MARKETING_LOGO_WORDMARK_URL = `${MARKETING_ASSET_ORIGIN}/notificas-wordmark.png`;

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
  preheader?: string;
  /** Preview sends skip click wrapping so the CTA hits the public site. */
  trackLinks?: boolean;
}): { html: string; text: string } {
  const merged = applyMergeFields(input.bodyHtml, input.fields);
  const tracked = input.trackLinks === false ? merged : wrapTrackedLinks(merged, input.sendId);
  const fromEmail = marketingContactEmail();
  const openUrl = marketingOpenUrl(input.sendId);
  const unsubUrl = marketingUnsubUrl(input.contactId);
  const preheader = input.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;font-size:1px;line-height:1px;">${escapeHtml(input.preheader)}</div>`
    : "";
  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Source+Serif+4:opsz,wght@8..60,400;8..60,600&amp;family=DM+Sans:wght@400;600;700&amp;display=swap" rel="stylesheet" />
</head>
<body style="margin:0;padding:0;background:#efe8dc;font-family:'Source Serif 4',Georgia,'Iowan Old Style','Palatino Linotype','Times New Roman',serif;color:#17303a;">
  ${preheader}
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#efe8dc;padding:28px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%;background:#fffcf7;border:1px solid #e0d6c6;">
          <tr>
            <td style="padding:28px 36px 20px;border-bottom:1px solid #eadfce;">
              <img src="${MARKETING_LOGO_WORDMARK_URL}" width="200" height="37" alt="Notificas" style="display:block;border:0;width:200px;height:auto;" />
            </td>
          </tr>
          <tr>
            <td style="padding:32px 36px 36px;font-size:17px;line-height:1.65;color:#243943;">${tracked}</td>
          </tr>
          <tr>
            <td style="padding:18px 36px 26px;border-top:1px solid #eadfce;font-family:'DM Sans',Arial,Helvetica,sans-serif;font-size:12px;line-height:1.55;color:#5c6e76;">
              Notificas · ${escapeHtml(fromEmail)}
              <br />
              <a href="${escapeHtml(unsubUrl)}" style="color:#5c6e76;">Darse de baja de estos correos</a>
            </td>
          </tr>
        </table>
        <img src="${escapeHtml(openUrl)}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0;" />
      </td>
    </tr>
  </table>
</body>
</html>`;
  const text = `${htmlToText(merged)}\n\n—\nNotificas · ${fromEmail}\nBaja: ${unsubUrl}`;
  return { html, text };
}
