/**
 * Cabeceras y texto plano para campañas: Outlook/Gmail penalizan HTML≠texto,
 * jerga tipo "blockchain/fehaciente" y envíos masivos sin List-Unsubscribe.
 */

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function listUnsubscribeUrl(appHostingUrl, docId, token) {
  const base = String(appHostingUrl || '').replace(/\/$/, '');
  return `${base}/api/mail/list-unsubscribe?m=${encodeURIComponent(docId)}&k=${encodeURIComponent(token)}`;
}

function htmlToPlainText(html) {
  return String(html || '')
    .replace(/<head[\s\S]*?<\/head>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<div[^>]*display\s*:\s*none[^>]*>[\s\S]*?<\/div>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/h[1-6]>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<a [^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_, href, label) => {
      const t = String(label).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
      return t ? `${t}\n${href}` : href;
    })
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function buildCampaignPlainText(params) {
  const html = params && params.html;
  const readerUrl = String((params && params.readerUrl) || '').trim();
  const recipientEmail = String((params && params.recipientEmail) || '').trim();
  const year = Number((params && params.year) || new Date().getFullYear());
  const parts = [];
  const fromHtml = htmlToPlainText(html);
  if (fromHtml) parts.push(fromHtml);
  if (readerUrl && !fromHtml.includes(readerUrl)) {
    parts.push(`Constancia de apertura:\n${readerUrl}`);
  }
  const dest = recipientEmail
    ? `Este mensaje fue destinado a ${recipientEmail}.`
    : '';
  parts.push(
    `${year} Notificas.com  ${dest} Si no reconoce este correo, ignore el mensaje o escriba a contacto@notificas.com.`
      .replace(/\s+/g, ' ')
      .trim()
  );
  return parts.filter(Boolean).join('\n\n');
}

function buildCampaignListHeaders(params) {
  const url = listUnsubscribeUrl(
    params && params.appHostingUrl,
    params && params.docId,
    params && params.trackingToken
  );
  const camp = String((params && params.campaignId) || 'none')
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, 24) || 'none';
  return {
    'List-Unsubscribe': `<${url}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    'Feedback-ID': `${camp}:notificas:campaign:mail`,
  };
}

function appendCampaignUnsubscribeFooter(html, unsubscribeUrl) {
  const url = String(unsubscribeUrl || '').trim();
  if (!html || !url) return html;
  if (/data-list-unsubscribe/.test(html)) return html;
  const block = `<p class="muted" data-list-unsubscribe style="margin:12px 0 0 0;font-size:11px;line-height:1.5;">Si no desea recibir más comunicaciones de campañas por correo, <a href="${escapeHtml(url)}" style="color:#64748b;">puede darse de baja</a>.</p>`;
  if (/class="footer"/i.test(html)) {
    const replaced = String(html).replace(
      /(<td class="footer">[\s\S]*?)(<\/div>)/i,
      `$1${block}$2`
    );
    if (replaced !== html) return replaced;
  }
  return String(html).replace(/<\/body>/i, `${block}</body>`);
}

module.exports = {
  listUnsubscribeUrl,
  htmlToPlainText,
  buildCampaignPlainText,
  buildCampaignListHeaders,
  appendCampaignUnsubscribeFooter,
};
