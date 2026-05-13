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
 *   - El botón "Acceder a la notificación" (que apunta al reader directo) pasa por `linkRedirectUrl` sin `u`.
 *   - Los `<a href="#">`, hrefs vacíos o relativos se reemplazan con la URL del reader.
 *   - Los `mailto:`, `tel:`, `javascript:` y `data:` se ignoran (se dejan tal cual).
 *   - Se añade un pixel invisible 1x1 que dispara `trackOpen` cuando el cliente del correo renderiza la imagen.
 *
 * Recibe las URLs por parámetro para permitir tests unitarios sin acoplarse a la config global.
 */
function injectTrackingIntoHtml(html, docId, token, urls) {
  if (!html) return html;
  const { trackingBaseUrl, linkRedirectUrl, appHostingUrl } = urls || {};
  if (!trackingBaseUrl || !linkRedirectUrl || !appHostingUrl) {
    throw new Error(
      'injectTrackingIntoHtml: faltan urls.trackingBaseUrl / urls.linkRedirectUrl / urls.appHostingUrl'
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
    const isValidHttpUrl =
      cleanHref &&
      cleanHref.match(/^https?:\/\//i) &&
      !cleanHref.startsWith(`${linkRedirectUrl}`);

    if (isMailtoOrTel || isScriptOrData) {
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

  // Pixel invisible 1x1 que dispara `trackOpen` cuando el cliente del correo
  // (o el destinatario) renderiza la imagen. Es la base del evento `email_opened`.
  // Nota: muchos clientes (Gmail/Outlook) cargan imágenes vía proxy y pueden disparar el pixel
  // sin intervención humana — el filtro de `KNOWN_SCANNER_PATTERNS` en trackOpen mitiga eso.
  const pixelUrl = `${trackingBaseUrl}?msg=${encodeURIComponent(docId)}&k=${encodeURIComponent(token)}`;
  const pixelTag = `<img src="${pixelUrl}" width="1" height="1" alt="" style="display:none!important;border:0;width:1px;height:1px;outline:none;text-decoration:none;visibility:hidden;" />`;
  if ($('body').length) {
    $('body').append(pixelTag);
  } else {
    $.root().append(pixelTag);
  }

  return {
    html: $.html(),
    stats: { processedCount, replacedCount, ignoredCount },
  };
}

module.exports = { injectTrackingIntoHtml, base64UrlEncode };
