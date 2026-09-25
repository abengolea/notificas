const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  isLinkPreviewCrawler,
  readerRedirectOrigin,
} = require('./link-redirect-origin');

function req(headers) {
  return {
    get(name) {
      return headers[name] || headers[name.toLowerCase()] || '';
    },
  };
}

test('un click que llegó por .com.ar no redirige a hosted.app', () => {
  const origin = readerRedirectOrigin(
    req({ 'X-Forwarded-Host': 'notificas.com.ar' }),
    'https://notificas--notificas-f9953.us-central1.hosted.app',
  );
  assert.equal(origin, 'https://notificas.com.ar');
});

test('sin host público, el reader tampoco cae en hosted.app', () => {
  const origin = readerRedirectOrigin(
    req({ Host: 'linkredirect-ju7n3yysfq-uc.a.run.app' }),
    'https://notificas--notificas-f9953.us-central1.hosted.app',
  );
  assert.equal(origin, 'https://notificas.com.ar');
});

test('el crawler de vista previa de WhatsApp no es un pulso real', () => {
  assert.equal(isLinkPreviewCrawler('WhatsApp/2.24.12.78'), true);
  assert.equal(
    isLinkPreviewCrawler(
      'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36',
    ),
    false,
  );
});
