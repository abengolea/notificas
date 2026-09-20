import { marketingClickUrl, marketingOpenUrl, marketingUnsubUrl } from "./tokens";
import { marketingContactEmail } from "./types";
import {
  contentFromLegacyHtml,
  isFullCampaignEmailHtml,
  MARKETING_ASSET_ORIGIN,
  MARKETING_LOGO_WORDMARK_URL,
  parseCampaignEmailContent,
  renderCampaignEmail,
  type CampaignEmailContent,
} from "./campaign-email";

export { MARKETING_ASSET_ORIGIN, MARKETING_LOGO_WORDMARK_URL };

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

function injectOpenPixel(html: string, sendId: string): string {
  if (!sendId) return html;
  const pixel = `<img src="${marketingOpenUrl(sendId)}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0;" />`;
  if (/<\/body>/i.test(html)) return html.replace(/<\/body>/i, `${pixel}</body>`);
  return `${html}${pixel}`;
}

/**
 * Ensambla el HTML de envío.
 * Si `bodyHtml` ya es el snapshot institucional, no vuelve a renderizar
 * (así un cambio futuro de plantilla no altera campañas ya congeladas).
 */
export function assembleMarketingHtml(input: {
  bodyHtml: string;
  sendId: string;
  contactId: string;
  fields: MergeFields;
  preheader?: string;
  textBody?: string;
  /** Preview and test sends skip click wrapping so the CTA hits the public site. */
  trackLinks?: boolean;
  emailContent?: CampaignEmailContent | null;
  injectPixel?: boolean;
}): { html: string; text: string } {
  const unsubUrl = marketingUnsubUrl(input.contactId);
  const fromEmail = marketingContactEmail();
  let sourceHtml: string;
  let sourceText: string;
  if (isFullCampaignEmailHtml(input.bodyHtml)) {
    sourceHtml = input.bodyHtml;
    sourceText = String(input.textBody || "").trim() || htmlToText(input.bodyHtml);
  } else {
    const content =
      parseCampaignEmailContent(input.emailContent) ||
      contentFromLegacyHtml(input.bodyHtml, {
        preheader: input.preheader,
        unsubscribeUrl: unsubUrl,
      });
    const rendered = renderCampaignEmail({
      ...content,
      preheader: input.preheader || content.preheader,
      unsubscribeUrl: unsubUrl,
    });
    sourceHtml = rendered.html;
    sourceText = String(input.textBody || "").trim() || rendered.text;
  }
  const mergedHtml = applyMergeFields(sourceHtml, input.fields).replace(/\{\{\s*unsubscribeUrl\s*\}\}/g, unsubUrl);
  const mergedText = applyMergeFields(sourceText, input.fields);
  const tracked = input.trackLinks === false ? mergedHtml : wrapTrackedLinks(mergedHtml, input.sendId);
  const html = input.injectPixel === false ? tracked : injectOpenPixel(tracked, input.sendId);
  const text = `${mergedText}\n\n—\nNotificas · ${fromEmail}\nBaja: ${unsubUrl}`;
  return { html, text };
}
