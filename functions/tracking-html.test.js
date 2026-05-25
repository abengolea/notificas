const { test } = require('node:test');
const assert = require('node:assert/strict');
const { injectTrackingIntoHtml, base64UrlEncode } = require('./tracking-html');

const URLS = {
  linkRedirectUrl: 'https://linkredirect-test.example.com',
  appHostingUrl: 'https://app-test.example.com',
};

const DOC_ID = 'docABC123';
const TOKEN = 'tok_xyz_456';

/**
 * Decodifica las entidades HTML básicas que cheerio agrega al serializar
 * para poder comparar URLs como strings normales en los asserts.
 */
function decodeHtmlEntities(s) {
  return s.replace(/&amp;/g, '&');
}

test('no inyecta pixel de apertura (trackOpen) en el HTML', () => {
  const input = '<html><body><p>Hola</p></body></html>';
  const { html } = injectTrackingIntoHtml(input, DOC_ID, TOKEN, URLS);
  const decoded = decodeHtmlEntities(html);
  assert.ok(!decoded.includes('trackopen'), decoded);
  assert.ok(!decoded.includes('width="1" height="1"'), decoded);
});

test('reescribe <a href="http..."> a linkRedirect con `u` codificado en base64url', () => {
  const input =
    '<html><body><a href="https://google.com/search?q=hola+mundo">Buscar</a></body></html>';
  const { html, stats } = injectTrackingIntoHtml(input, DOC_ID, TOKEN, URLS);
  const decoded = decodeHtmlEntities(html);

  const expectedEncoded = base64UrlEncode('https://google.com/search?q=hola+mundo');
  const expectedHref = `${URLS.linkRedirectUrl}?msg=${DOC_ID}&u=${expectedEncoded}&k=${TOKEN}`;
  assert.ok(
    decoded.includes(`href="${expectedHref}"`),
    `href esperado ${expectedHref} no apareció en:\n${decoded}`
  );
  assert.equal(stats.processedCount, 1);
  assert.equal(stats.replacedCount, 0);
});

test('el botón "Acceder a la notificación" (URL del reader) pasa por linkRedirect sin `u`', () => {
  const readerUrl = `${URLS.appHostingUrl}/reader/${DOC_ID}?k=${TOKEN}`;
  const input = `<html><body><a href="${readerUrl}">Acceder</a></body></html>`;
  const { html } = injectTrackingIntoHtml(input, DOC_ID, TOKEN, URLS);
  const decoded = decodeHtmlEntities(html);

  const expectedHref = `${URLS.linkRedirectUrl}?msg=${DOC_ID}&k=${TOKEN}`;
  assert.ok(decoded.includes(`href="${expectedHref}"`));
  // No debe contener "&u=" en el href (solo msg+k)
  const hrefMatch = decoded.match(/href="([^"]+)"/);
  assert.ok(hrefMatch && !hrefMatch[1].includes('&u='));
});

test('href="#" y hrefs relativos se reemplazan por la URL del reader; href="" se IGNORA (comportamiento heredado)', () => {
  const input =
    '<html><body>' +
    '<a href="#">Hash</a>' +
    '<a href="">Vacío</a>' +
    '<a href="/relativa">Relativa</a>' +
    '</body></html>';
  const { html, stats } = injectTrackingIntoHtml(input, DOC_ID, TOKEN, URLS);
  const decoded = decodeHtmlEntities(html);

  const readerUrl = `${URLS.appHostingUrl}/reader/${DOC_ID}?k=${TOKEN}`;
  const occurrences = (decoded.match(new RegExp(
    readerUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'
  )) || []).length;

  // Solo "#" y "/relativa" se reemplazan; "" se ignora (heredado). 2 reemplazos.
  assert.equal(occurrences, 2, `Esperados 2 reemplazos al readerUrl, hubo ${occurrences}`);
  assert.equal(stats.replacedCount, 2);
  assert.equal(stats.ignoredCount, 1);
});

test('mailto:, tel:, javascript: y data: NO se reescriben', () => {
  const input =
    '<html><body>' +
    '<a href="mailto:contacto@notificas.com">Mail</a>' +
    '<a href="tel:+5491112345678">Tel</a>' +
    '<a href="javascript:void(0)">JS</a>' +
    '<a href="data:text/plain,hola">Data</a>' +
    '</body></html>';
  const { html, stats } = injectTrackingIntoHtml(input, DOC_ID, TOKEN, URLS);

  assert.match(html, /href="mailto:contacto@notificas\.com"/);
  assert.match(html, /href="tel:\+5491112345678"/);
  assert.match(html, /href="javascript:void\(0\)"/);
  assert.match(html, /href="data:text\/plain,hola"/);
  assert.equal(stats.ignoredCount, 4);
  assert.equal(stats.processedCount, 0);
});

test('un enlace que ya empieza con linkRedirectUrl NO se duplica: cae al reader (no se anida)', () => {
  const alreadyRedirect = `${URLS.linkRedirectUrl}?msg=${DOC_ID}&u=abc&k=${TOKEN}`;
  const input = `<html><body><a href="${alreadyRedirect}">Existente</a></body></html>`;
  const { html } = injectTrackingIntoHtml(input, DOC_ID, TOKEN, URLS);
  const decoded = decodeHtmlEntities(html);

  // Crítico: el href final no debe contener `linkRedirectUrl?...linkRedirectUrl?...` (anidado).
  // El comportamiento actual es que el enlace ya redirigido se considera "inválido" para tracking
  // (porque empieza con linkRedirectUrl) y se reemplaza por el readerUrl. Esto previene loops.
  const readerUrl = `${URLS.appHostingUrl}/reader/${DOC_ID}?k=${TOKEN}`;
  assert.ok(
    decoded.includes(`href="${readerUrl}"`),
    `Se esperaba que el href se reemplazara al readerUrl. Got:\n${decoded}`
  );
  // No hay anidamiento de linkRedirect dentro de linkRedirect.
  assert.ok(!decoded.match(/linkredirect-test\.example\.com.+linkredirect-test\.example\.com/));
});

test('enlace linkRedirect con parámetro att= (adjunto en correo) se deja intacto', () => {
  const attHref = `${URLS.linkRedirectUrl}?msg=${encodeURIComponent(DOC_ID)}&k=${encodeURIComponent(TOKEN)}&att=${encodeURIComponent('docABC123_0')}`;
  const input = `<html><body><a href="${attHref}">Ver PDF</a></body></html>`;
  const { html, stats } = injectTrackingIntoHtml(input, DOC_ID, TOKEN, URLS);
  const decoded = decodeHtmlEntities(html);
  assert.ok(
    decoded.includes(attHref) || (decoded.includes('att=') && decoded.includes('docABC123_0')),
    decoded,
  );
  assert.equal(stats.processedCount, 0);
  assert.equal(stats.replacedCount, 0);
  assert.equal(stats.ignoredCount, 1);
});

test('sin <body> el HTML se serializa sin añadir pixel', () => {
  const input = '<p>Sin body</p><a href="https://example.com">Link</a>';
  const { html } = injectTrackingIntoHtml(input, DOC_ID, TOKEN, URLS);
  const decoded = decodeHtmlEntities(html);
  assert.ok(!decoded.includes('trackopen'));
});

test('html vacío devuelve el mismo input sin error', () => {
  assert.equal(injectTrackingIntoHtml('', DOC_ID, TOKEN, URLS), '');
  assert.equal(injectTrackingIntoHtml(null, DOC_ID, TOKEN, URLS), null);
  assert.equal(injectTrackingIntoHtml(undefined, DOC_ID, TOKEN, URLS), undefined);
});

test('faltar urls lanza error explícito', () => {
  assert.throws(
    () => injectTrackingIntoHtml('<p>x</p>', DOC_ID, TOKEN, { linkRedirectUrl: 'a' }),
    /faltan urls/i
  );
});

test('docId y token con caracteres especiales se url-encodean en links', () => {
  const docIdRaw = 'doc/with spaces&special';
  const tokenRaw = 'tok+/=raw';
  const input = '<html><body><a href="https://x.com">X</a></body></html>';
  const { html } = injectTrackingIntoHtml(input, docIdRaw, tokenRaw, URLS);
  const decoded = decodeHtmlEntities(html);

  const expectedDoc = encodeURIComponent(docIdRaw);
  const expectedTok = encodeURIComponent(tokenRaw);
  assert.ok(decoded.includes(`msg=${expectedDoc}`));
  assert.ok(decoded.includes(`k=${expectedTok}`));
});

test('regresión bug undefined: el módulo NO inyecta campos undefined al serializar', () => {
  // Este test se asegura de que el HTML output sea siempre una string válida sin "undefined" literal,
  // ya que un undefined en docId/token/urls produciría URLs basura tipo "?msg=undefined&k=undefined".
  const { html } = injectTrackingIntoHtml('<html><body><p>x</p></body></html>', DOC_ID, TOKEN, URLS);
  assert.ok(!html.includes('undefined'), `HTML output contiene "undefined":\n${html}`);
});
