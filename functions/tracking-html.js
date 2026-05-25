const cheerio = require('cheerio');

/**
 * Codifica una string a Base64URL (sin `+`, `/`, ni padding `=`).
 * Replicado aquí para mantener este módulo independiente del index.js y testeable en aislamiento.
 */
function base64UrlEncode(str) {
  return Buffer.from(str, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

/**
 * Procesa el HTML del correo y le inyecta el tracking de Notificas:
 *   - Cada `<a href="http(s)://...">` se reescribe para pasar por `linkRedirectUrl` (registra `link_clicked`).
 *   - Enlaces ya armados como `linkRedirectUrl?...&att=...` (adjunto desde el correo) se dejan sin tocar.
 *   - El botón "Acceder a la notificación" (que apunta al reader directo) pasa por `linkRedirectUrl` sin `u`.
 *   - Los `<a href="#">`, hrefs vacíos o relativos se reemplazan con la URL del reader.
 *   - Los `mailto:`, `tel:`, `javascript:` y `data:` se ignoran (se dejan tal cual).
 *   - La apertura fehaciente del mensaje se registra al abrir el reader con ?k= (no hay pixel en el HTML).
 *
 * Recibe las URLs por parámetro para permitir tests unitarios sin acoplarse a la config global.
 */
function injectTrackingIntoHtml(html, docId, token, urls) {
  if (!html) return html;
  const { linkRedirectUrl, appHostingUrl } = urls || {};
  if (!linkRedirectUrl || !appHostingUrl) {
    throw new Error(
      'injectTrackingIntoHtml: faltan urls.linkRedirectUrl / urls.appHostingUrl'
    );
  }

  const $ = cheerio.load(html, { decodeEntities: false });

  let processedCount = 0;
  let replacedCount = 0;
  let ignoredCount = 0;

  const readerUrl = `${appHostingUrl}/reader/${encodeURIComponent(docId)}?k=${encodeURIComponent(token)}`;

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href) {
      ignoredCount++;
      return;
    }
    const cleanHref = href.trim();

    const isMailtoOrTel = cleanHref.startsWith('mailto:') || cleanHref.startsWith('tel:');
    const isScriptOrData = cleanHref.startsWith('javascript:') || cleanHref.startsWith('data:');
    /** Enlaces ya armados en sendEmail (adjunto desde correo); no tocar ni anidar otro linkRedirect. */
    const isAttachmentRedirectLink =
      typeof linkRedirectUrl === 'string' &&
      cleanHref.startsWith(linkRedirectUrl) &&
      /[?&]att=/.test(cleanHref);
    const isValidHttpUrl =
      cleanHref &&
      cleanHref.match(/^https?:\/\//i) &&
      !cleanHref.startsWith(`${linkRedirectUrl}`);

    if (isMailtoOrTel || isScriptOrData) {
      ignoredCount++;
      return;
    }

    if (isAttachmentRedirectLink) {
      ignoredCount++;
      return;
    }

    if (!isValidHttpUrl || cleanHref === '' || cleanHref === '#' || cleanHref.startsWith('#')) {
      $(el).attr('href', readerUrl);
      replacedCount++;
      return;
    }

    const isReaderUrl = cleanHref.includes('/reader/') && cleanHref.includes(`?k=`);
    if (isReaderUrl) {
      const trackUrl = `${linkRedirectUrl}?msg=${encodeURIComponent(docId)}&k=${encodeURIComponent(token)}`;
      $(el).attr('href', trackUrl);
      processedCount++;
      return;
    }

    const encoded = base64UrlEncode(cleanHref);
    const redirectUrl = `${linkRedirectUrl}?msg=${encodeURIComponent(docId)}&u=${encoded}&k=${encodeURIComponent(token)}`;
    $(el).attr('href', redirectUrl);
    processedCount++;
  });

  return {
    html: $.html(),
    stats: { processedCount, replacedCount, ignoredCount },
  };
}

module.exports = { injectTrackingIntoHtml, base64UrlEncode };
