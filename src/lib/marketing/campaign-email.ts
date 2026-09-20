/**
 * Plantilla institucional de campañas comerciales del CRM.
 * Un solo renderer para preview, prueba, envío y copias.
 *
 * THESIS: carta comercial B2B de certificación digital, no newsletter ni landing.
 * OWN-WORLD: papel #F4F8FD, carta blanca, azul #1B75E8, títulos Syne/Arial.
 * STORY: qué se comunica, a quién aplica, cómo pedir una demo.
 * FIRST VIEWPORT: logo, trazo azul, título 28px, bajada, beneficios, CTA.
 * FORM: correo HTML table-based, 600px, compatible con Gmail/Outlook.
 * FINISH: el HTML del preview es el HTML enviado, menos pixel y wrapping de clics.
 */

export const CAMPAIGN_EMAIL_TEMPLATE_ID = "institutional_v1";
export const CAMPAIGN_EMAIL_TEMPLATE_VERSION = 1;
export const CAMPAIGN_EMAIL_MARKER = `notificas-campaign-email:${CAMPAIGN_EMAIL_TEMPLATE_ID}`;

export const MARKETING_ASSET_ORIGIN = "https://notificas.com.ar";
export const MARKETING_LOGO_WORDMARK_URL = `${MARKETING_ASSET_ORIGIN}/notificas-wordmark.png`;

export const CAMPAIGN_EMAIL_COLORS = {
  page: "#F4F8FD",
  card: "#FFFFFF",
  ink: "#0C1929",
  brand: "#1B75E8",
  navy: "#1A2E45",
  text: "#172436",
  muted: "#52657A",
  line: "#D8E4F0",
  verify: "#1EAF6A",
} as const;

const TITLE_FONT = "'Syne', Arial, Helvetica, sans-serif";
const BODY_FONT = "'IBM Plex Sans', Arial, Helvetica, sans-serif";

export type CampaignEmailBenefit = {
  title?: string;
  body: string;
};

export type CampaignEmailContent = {
  preheader?: string;
  eyebrow?: string;
  title: string;
  introduction?: string;
  paragraphs: string[];
  benefits: CampaignEmailBenefit[];
  callToActionLabel?: string;
  callToActionUrl?: string;
  senderName?: string;
  senderRole?: string;
  companyName?: string;
  website?: string;
  unsubscribeUrl?: string;
  recipientCompany?: string;
  campaignName?: string;
  receivedWhy?: string;
  /** HTML legado del editor libre. Solo para campañas anteriores. */
  htmlBodyFragment?: string;
};

export const PREVIEW_UNSUBSCRIBE_URL = "https://notificas.com.ar/api/marketing/u/preview";

export const PREVIEW_MERGE_FIELDS = {
  nombre: "Adrián",
  empresa: "su empresa",
  pais: "Argentina",
  cargo: "",
  email: "contacto@empresa.com",
};

export const DEFAULT_SENDER = {
  senderName: "Adrián Bengolea",
  senderRole: "Gerente",
  companyName: "Notificas S.R.L.",
  website: "https://www.notificas.com",
  callToActionLabel: "Coordinar una demostración",
  callToActionUrl: "mailto:adrianbengolea@notificas.com?subject=Demostraci%C3%B3n%20Notificas",
};

export const OILFIELD_USE_CASES: CampaignEmailBenefit[] = [
  { body: "Recibos y documentación laboral" },
  { body: "Altas, citaciones y cambios de turno" },
  { body: "Protocolos HSE y capacitaciones" },
  { body: "Instrucciones operativas" },
  { body: "Comunicaciones a contratistas y proveedores" },
  { body: "Cambios contractuales y requerimientos documentales" },
];

export const VACA_MUERTA_OILFIELD_CONTENT: CampaignEmailContent = {
  preheader: "Evidencia de qué se comunicó, cuándo y a quién, para cuadrillas, contratistas y documentación laboral.",
  eyebrow: "Vaca Muerta · Servicios petroleros y perforación",
  title: "Comunicaciones trazables para personal y contratistas",
  introduction: "Hola,",
  paragraphs: [
    "En operaciones con cuadrillas rotativas, personal en yacimientos y múltiples contratistas, muchas comunicaciones importantes todavía quedan dispersas entre correos comunes, mensajes y entregas en papel.",
    "Notificas permite enviar comunicaciones digitales y conservar evidencia verificable del contenido, la fecha, el destinatario y la recepción, desde una plataforma centralizada.",
    "La propuesta apunta a reducir tiempos y costos de gestión, facilitar auditorías y evitar discusiones sobre qué se comunicó, cuándo y a quién.",
    "Nos gustaría coordinar una breve demostración para evaluar qué circuitos de su empresa podrían digitalizarse con Notificas.",
  ],
  benefits: OILFIELD_USE_CASES,
  callToActionLabel: DEFAULT_SENDER.callToActionLabel,
  callToActionUrl: DEFAULT_SENDER.callToActionUrl,
  senderName: DEFAULT_SENDER.senderName,
  senderRole: DEFAULT_SENDER.senderRole,
  companyName: DEFAULT_SENDER.companyName,
  website: DEFAULT_SENDER.website,
  campaignName: "Vaca Muerta | Servicios petroleros y perforación | Primera aproximación",
};

export function blankCampaignEmailContent(partial?: Partial<CampaignEmailContent>): CampaignEmailContent {
  return {
    ...DEFAULT_SENDER,
    preheader: "",
    eyebrow: "",
    title: "",
    introduction: "Hola {{nombre}},",
    paragraphs: [""],
    benefits: [],
    receivedWhy: "",
    campaignName: "",
    ...partial,
  };
}

export function paragraphsToText(paragraphs: string[]): string {
  return paragraphs.filter(Boolean).join("\n\n");
}

export function textToParagraphs(value: string): string[] {
  return String(value || "")
    .split(/\n\s*\n/)
    .map((row) => row.trim())
    .filter(Boolean);
}

export function benefitsToText(benefits: CampaignEmailBenefit[]): string {
  return benefits
    .map((row) => (row.title ? `${row.title}: ${row.body}` : row.body))
    .filter(Boolean)
    .join("\n");
}

export function textToBenefits(value: string): CampaignEmailBenefit[] {
  return String(value || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const idx = line.indexOf(": ");
      if (idx > 0 && idx < 80) return { title: line.slice(0, idx).trim(), body: line.slice(idx + 2).trim() };
      return { body: line };
    });
}

export function applyCampaignMergeFields(template: string, fields: Record<string, string>): string {
  return template.replace(/\{\{\s*([a-zA-Z_]+)\s*\}\}/g, (full, key: string) => {
    const k = key.toLowerCase();
    if (Object.prototype.hasOwnProperty.call(fields, k)) return fields[k] || "";
    return full;
  });
}

export function previewCampaignEmail(
  input: CampaignEmailContent,
  fields: Record<string, string> = PREVIEW_MERGE_FIELDS,
): { html: string; text: string } {
  const rendered = renderCampaignEmail({
    ...input,
    unsubscribeUrl: input.unsubscribeUrl || PREVIEW_UNSUBSCRIBE_URL,
  });
  return {
    html: applyCampaignMergeFields(rendered.html, fields),
    text: applyCampaignMergeFields(rendered.text, fields),
  };
}

function omitBlank<T extends Record<string, unknown>>(row: T): T {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (value === undefined || value === "") continue;
    out[key] = value;
  }
  return out as T;
}

export function persistCampaignEmail(
  input: Partial<CampaignEmailContent> & { htmlBody?: string; name?: string; subject?: string },
): {
  emailContent: CampaignEmailContent;
  htmlBody: string;
  textBody: string;
  templateId: string;
  templateVersion: number;
} {
  const htmlBody = String(input.htmlBody || "");
  const parsed = parseCampaignEmailContent(input);
  const structuredHasCopy = Boolean(
    parsed &&
      (parsed.paragraphs.length > 0 || parsed.benefits.length > 0 || parsed.htmlBodyFragment),
  );
  if (structuredHasCopy && parsed) {
    return buildCampaignEmailSnapshot({
      ...parsed,
      campaignName: parsed.campaignName || String(input.name || input.campaignName || ""),
    });
  }
  if (isFullCampaignEmailHtml(htmlBody) && !structuredHasCopy) {
    return {
      emailContent: parsed || contentFromLegacyHtml(htmlBody, input),
      htmlBody,
      textBody: parsed ? campaignEmailToText(parsed) : htmlToTextSafe(htmlBody),
      templateId: CAMPAIGN_EMAIL_TEMPLATE_ID,
      templateVersion: CAMPAIGN_EMAIL_TEMPLATE_VERSION,
    };
  }
  const content = contentFromLegacyHtml(htmlBody, {
    ...input,
    ...(parsed || {}),
    title: parsed?.title || input.title || input.subject || "Notificas",
    campaignName: parsed?.campaignName || input.campaignName || input.name || "",
  });
  return buildCampaignEmailSnapshot({
    ...content,
    campaignName: content.campaignName || String(input.name || input.campaignName || ""),
  });
}

function htmlToTextSafe(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
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

export function snapshotFieldsForCampaign(camp: {
  emailContent?: unknown;
  htmlBody?: unknown;
  name?: unknown;
  subject?: unknown;
}): ReturnType<typeof persistCampaignEmail> {
  const parsed = parseCampaignEmailContent(camp.emailContent);
  return persistCampaignEmail({
    ...(parsed || {}),
    htmlBody: String(camp.htmlBody || ""),
    name: String(camp.name || ""),
    subject: String(camp.subject || ""),
    title: parsed?.title || String(camp.subject || ""),
    campaignName: parsed?.campaignName || String(camp.name || ""),
  });
}

export function escapeEmailText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function isFullCampaignEmailHtml(html: string): boolean {
  return html.includes(CAMPAIGN_EMAIL_MARKER);
}

function asBenefit(row: CampaignEmailBenefit | string): CampaignEmailBenefit {
  if (typeof row === "string") return { body: row.trim() };
  const title = row.title?.trim();
  const body = String(row.body || "").trim();
  return title ? { title, body } : { body };
}

export function normalizeCampaignEmailContent(input: Partial<CampaignEmailContent> & { title?: string }): CampaignEmailContent {
  const paragraphs = Array.isArray(input.paragraphs)
    ? input.paragraphs.map((row) => String(row || "").trim()).filter(Boolean)
    : [];
  const benefits = Array.isArray(input.benefits)
    ? input.benefits.map(asBenefit).filter((row) => row.body)
    : [];
  return {
    preheader: String(input.preheader || "").trim(),
    eyebrow: String(input.eyebrow || "").trim(),
    title: String(input.title || "").trim() || "Notificas",
    introduction: String(input.introduction || "").trim(),
    paragraphs,
    benefits,
    callToActionLabel: String(input.callToActionLabel || DEFAULT_SENDER.callToActionLabel).trim(),
    callToActionUrl: String(input.callToActionUrl || DEFAULT_SENDER.callToActionUrl).trim(),
    senderName: String(input.senderName || DEFAULT_SENDER.senderName).trim(),
    senderRole: String(input.senderRole || DEFAULT_SENDER.senderRole).trim(),
    companyName: String(input.companyName || DEFAULT_SENDER.companyName).trim(),
    website: String(input.website || DEFAULT_SENDER.website).trim(),
    unsubscribeUrl: String(input.unsubscribeUrl || "{{unsubscribeUrl}}").trim() || "{{unsubscribeUrl}}",
    recipientCompany: String(input.recipientCompany || "").trim(),
    campaignName: String(input.campaignName || "").trim(),
    receivedWhy: String(input.receivedWhy || "").trim(),
    htmlBodyFragment: input.htmlBodyFragment?.trim() || "",
  };
}

export function parseCampaignEmailContent(raw: unknown): CampaignEmailContent | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const title = String(row.title || "").trim();
  const paragraphs = Array.isArray(row.paragraphs) ? row.paragraphs.map(String) : [];
  const benefits = Array.isArray(row.benefits) ? row.benefits : [];
  const fragment = String(row.htmlBodyFragment || "").trim();
  if (!title && paragraphs.length === 0 && benefits.length === 0 && !fragment) return null;
  return normalizeCampaignEmailContent({
    preheader: String(row.preheader || ""),
    eyebrow: String(row.eyebrow || ""),
    title,
    introduction: String(row.introduction || ""),
    paragraphs,
    benefits: benefits.map((item) =>
      item && typeof item === "object"
        ? { title: String((item as CampaignEmailBenefit).title || ""), body: String((item as CampaignEmailBenefit).body || "") }
        : { body: String(item || "") },
    ),
    callToActionLabel: String(row.callToActionLabel || ""),
    callToActionUrl: String(row.callToActionUrl || ""),
    senderName: String(row.senderName || ""),
    senderRole: String(row.senderRole || ""),
    companyName: String(row.companyName || ""),
    website: String(row.website || ""),
    unsubscribeUrl: String(row.unsubscribeUrl || ""),
    recipientCompany: String(row.recipientCompany || ""),
    campaignName: String(row.campaignName || ""),
    receivedWhy: String(row.receivedWhy || ""),
    htmlBodyFragment: fragment,
  });
}

function paragraphHtml(text: string): string {
  return escapeEmailText(text).replace(/\n/g, "<br />");
}

function websiteHref(url: string): string {
  const trimmed = url.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed.replace(/^\/+/, "")}`;
}

function websiteLabel(url: string): string {
  return url.replace(/^https?:\/\//i, "").replace(/\/$/, "");
}

export function campaignEmailToText(content: CampaignEmailContent): string {
  const data = normalizeCampaignEmailContent(content);
  const lines: string[] = [];
  if (data.eyebrow) lines.push(data.eyebrow);
  lines.push(data.title);
  if (data.introduction) lines.push("", data.introduction);
  for (const p of data.paragraphs) lines.push("", p);
  if (data.benefits.length) {
    lines.push("", "Casos de uso:");
    for (const row of data.benefits) lines.push(`- ${row.title ? `${row.title}: ` : ""}${row.body}`);
  }
  if (data.callToActionLabel && data.callToActionUrl) {
    lines.push("", `${data.callToActionLabel}: ${data.callToActionUrl}`);
  }
  lines.push(
    "",
    data.senderName || DEFAULT_SENDER.senderName,
    data.senderRole || DEFAULT_SENDER.senderRole,
    data.companyName || DEFAULT_SENDER.companyName,
    websiteLabel(data.website || DEFAULT_SENDER.website),
  );
  if (data.receivedWhy) lines.push("", data.receivedWhy);
  lines.push("", websiteHref(data.website || DEFAULT_SENDER.website));
  if (data.unsubscribeUrl && data.unsubscribeUrl !== "{{unsubscribeUrl}}") {
    lines.push(`Darse de baja: ${data.unsubscribeUrl}`);
  }
  return lines.join("\n").trim();
}

export function renderCampaignEmail(input: CampaignEmailContent): { html: string; text: string } {
  const data = normalizeCampaignEmailContent(input);
  const c = CAMPAIGN_EMAIL_COLORS;
  const unsub = data.unsubscribeUrl || "{{unsubscribeUrl}}";
  const website = data.website || DEFAULT_SENDER.website;
  const senderName = data.senderName || DEFAULT_SENDER.senderName;
  const senderRole = data.senderRole || DEFAULT_SENDER.senderRole;
  const companyName = data.companyName || DEFAULT_SENDER.companyName;
  const site = websiteHref(website);
  const siteLabel = websiteLabel(website);
  const benefitsRows = data.benefits
    .map((row) => {
      const label = row.title ? `<strong>${escapeEmailText(row.title)}.</strong> ` : "";
      return `<tr>
        <td valign="top" width="18" style="padding:0 10px 10px 0;color:${c.verify};font-family:${BODY_FONT};font-size:16px;line-height:1.55;">&#9679;</td>
        <td valign="top" style="padding:0 0 10px 0;color:${c.text};font-family:${BODY_FONT};font-size:16px;line-height:1.55;">${label}${paragraphHtml(row.body)}</td>
      </tr>`;
    })
    .join("");
  const benefitsBlock = data.benefits.length
    ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 28px;background:${c.page};border:1px solid ${c.line};">
        <tr>
          <td style="padding:20px 22px 10px;">
            <p style="margin:0 0 12px;font-family:${BODY_FONT};font-size:13px;letter-spacing:0.08em;text-transform:uppercase;color:${c.navy};font-weight:600;">Casos de uso</p>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0">${benefitsRows}</table>
          </td>
        </tr>
      </table>`
    : "";
  const intro = data.introduction
    ? `<p style="margin:0 0 16px;font-family:${BODY_FONT};font-size:16px;line-height:1.55;color:${c.text};">${paragraphHtml(data.introduction)}</p>`
    : "";
  const paragraphs = data.paragraphs
    .map(
      (p) =>
        `<p style="margin:0 0 16px;font-family:${BODY_FONT};font-size:16px;line-height:1.55;color:${c.text};">${paragraphHtml(p)}</p>`,
    )
    .join("");
  const fragment = data.htmlBodyFragment
    ? `<div style="margin:0 0 22px;font-family:${BODY_FONT};font-size:16px;line-height:1.55;color:${c.text};">${data.htmlBodyFragment}</div>`
    : "";
  const eyebrow = data.eyebrow
    ? `<p style="margin:0 0 10px;font-family:${BODY_FONT};font-size:13px;line-height:1.4;letter-spacing:0.06em;text-transform:uppercase;color:${c.brand};font-weight:600;">${escapeEmailText(data.eyebrow)}</p>`
    : "";
  const cta =
    data.callToActionLabel && data.callToActionUrl
      ? `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:8px 0 28px;">
          <tr>
            <td bgcolor="${c.brand}" style="background:${c.brand};">
              <a href="${escapeEmailText(data.callToActionUrl)}" target="_blank" rel="noopener" style="display:inline-block;padding:14px 26px;font-family:${BODY_FONT};font-size:16px;line-height:1.2;font-weight:600;color:#ffffff;text-decoration:none;">${escapeEmailText(data.callToActionLabel)}</a>
            </td>
          </tr>
        </table>`
      : "";
  const why = data.receivedWhy
    ? `<p style="margin:10px 0 0;font-family:${BODY_FONT};font-size:12px;line-height:1.55;color:${c.muted};">${paragraphHtml(data.receivedWhy)}</p>`
    : "";
  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light" />
  <meta name="supported-color-schemes" content="light" />
  <title>${escapeEmailText(data.title)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&amp;family=Syne:wght@600;700&amp;display=swap" rel="stylesheet" />
</head>
<body style="margin:0;padding:0;background:${c.page};">
  <!-- ${CAMPAIGN_EMAIL_MARKER} -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;font-size:1px;line-height:1px;">${escapeEmailText(data.preheader || "")}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${c.page};">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="width:100%;max-width:600px;background:${c.card};border:1px solid ${c.line};">
          <tr>
            <td style="padding:28px 36px 18px;">
              <img src="${MARKETING_LOGO_WORDMARK_URL}" width="200" height="37" alt="Notificas" style="display:block;border:0;width:200px;height:auto;" />
            </td>
          </tr>
          <tr>
            <td style="padding:0 36px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr><td height="3" style="height:3px;line-height:3px;font-size:0;background:${c.brand};">&nbsp;</td></tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 36px 8px;">
              ${eyebrow}
              <h1 style="margin:0 0 14px;font-family:${TITLE_FONT};font-size:28px;line-height:1.2;font-weight:700;color:${c.ink};">${escapeEmailText(data.title)}</h1>
              ${intro}
              ${paragraphs}
              ${fragment}
              ${benefitsBlock}
              ${cta}
              <p style="margin:0 0 4px;font-family:${BODY_FONT};font-size:16px;line-height:1.55;color:${c.text};">${escapeEmailText(senderName)}</p>
              <p style="margin:0 0 2px;font-family:${BODY_FONT};font-size:16px;line-height:1.55;color:${c.muted};">${escapeEmailText(senderRole)}</p>
              <p style="margin:0;font-family:${BODY_FONT};font-size:16px;line-height:1.55;color:${c.muted};">${escapeEmailText(companyName)}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:22px 36px 28px;border-top:1px solid ${c.line};">
              <p style="margin:0 0 6px;font-family:${BODY_FONT};font-size:12px;line-height:1.55;color:${c.muted};">
                <a href="${escapeEmailText(site)}" style="color:${c.navy};text-decoration:underline;">${escapeEmailText(siteLabel)}</a>
                · Notificas S.R.L.
              </p>
              <p style="margin:0;font-family:${BODY_FONT};font-size:12px;line-height:1.55;color:${c.muted};">
                <a href="${escapeEmailText(unsub)}" style="color:${c.muted};text-decoration:underline;">Darse de baja de estos correos</a>
              </p>
              ${why}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  return { html, text: campaignEmailToText(data) };
}

export function buildCampaignEmailSnapshot(input: Partial<CampaignEmailContent> & { title?: string }): {
  emailContent: CampaignEmailContent;
  htmlBody: string;
  textBody: string;
  templateId: string;
  templateVersion: number;
} {
  const emailContent = omitBlank({
    ...normalizeCampaignEmailContent(input),
    unsubscribeUrl: "{{unsubscribeUrl}}",
    htmlBodyFragment: input.htmlBodyFragment?.trim() || undefined,
  } as CampaignEmailContent);
  const rendered = renderCampaignEmail({ ...emailContent, unsubscribeUrl: "{{unsubscribeUrl}}" });
  return {
    emailContent,
    htmlBody: rendered.html,
    textBody: rendered.text,
    templateId: CAMPAIGN_EMAIL_TEMPLATE_ID,
    templateVersion: CAMPAIGN_EMAIL_TEMPLATE_VERSION,
  };
}

function stripHtmlText(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function isLegacySignatureLine(text: string): boolean {
  return (
    /^saludos,?$/i.test(text) ||
    /^adri[aá]n bengolea/i.test(text) ||
    /^gerente$/i.test(text) ||
    /^notificas s\.?r\.?l\.?$/i.test(text) ||
    /^www\.notificas\.com/i.test(text) ||
    /^puede utilizarse para:?$/i.test(text) ||
    /^algunos circuitos posibles son:?$/i.test(text)
  );
}

export function contentFromLegacyHtml(htmlBody: string, extras?: Partial<CampaignEmailContent>): CampaignEmailContent {
  const trimmed = String(htmlBody || "").trim();
  if (isFullCampaignEmailHtml(trimmed) && extras && (extras.paragraphs?.length || extras.benefits?.length)) {
    return normalizeCampaignEmailContent({ ...extras, title: extras.title || "Notificas" });
  }
  const listItems: string[] = [];
  const withoutLists = trimmed.replace(/<ul[\s\S]*?<\/ul>/gi, (block) => {
    for (const item of block.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)) {
      const body = stripHtmlText(item[1]).replace(/[;.:]+$/, "");
      if (body) listItems.push(body.charAt(0).toUpperCase() + body.slice(1));
    }
    return "\n";
  });
  const paragraphMatches = [...withoutLists.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)];
  const extracted = paragraphMatches
    .map((row) => stripHtmlText(row[1]))
    .filter((row) => row && !isLegacySignatureLine(row));
  const fallback = !paragraphMatches.length && !listItems.length
    ? (trimmed && !/<[a-z][\s\S]*>/i.test(trimmed) ? [trimmed] : extras?.paragraphs || [])
    : [];
  const blocks = extracted.length ? extracted : fallback;
  const introduction = extras?.introduction || (blocks[0] && /^(hola|buenos d[ií]as)\b/i.test(blocks[0]) ? blocks[0] : "");
  const paragraphs = extras?.paragraphs?.length
    ? extras.paragraphs
    : blocks.filter((row) => row !== introduction);
  return normalizeCampaignEmailContent({
    ...DEFAULT_SENDER,
    ...extras,
    title: extras?.title || "Notificas",
    introduction,
    paragraphs,
    benefits: extras?.benefits?.length ? extras.benefits : listItems.map((body) => ({ body })),
    htmlBodyFragment: "",
  });
}
