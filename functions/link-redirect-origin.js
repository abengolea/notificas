const PUBLIC_READER_ORIGIN = 'https://notificas.com.ar';

function hostnameOf(hostHeader) {
  let value = String(hostHeader || '').trim().toLowerCase();
  if (!value) return '';
  if (value.startsWith('http://') || value.startsWith('https://')) {
    try {
      return new URL(value).hostname.toLowerCase();
    } catch {
      value = value.replace(/^https?:\/\//, '');
    }
  }
  return (value.split('/')[0] || '').split(':')[0] || '';
}

function isLinkPreviewCrawler(userAgent) {
  const ua = String(userAgent || '');
  if (!ua) return false;
  if (/facebookexternalhit|facebot/i.test(ua)) return true;
  return /whatsapp\//i.test(ua) && !/mozilla/i.test(ua);
}

/**
 * Destino del reader para el 302. Si el click llegó por .com.ar, no mandar
 * el WebView de WhatsApp a *.hosted.app (WhatsApp Web sí lo abre; la app no).
 */
function readerRedirectOrigin(req, fallbackOrigin) {
  const forwarded = String(req?.get?.('X-Forwarded-Host') || req?.get?.('x-forwarded-host') || '')
    .split(',')[0]
    .trim();
  const host = hostnameOf(forwarded || req?.get?.('Host') || req?.get?.('host') || '');
  if (
    host === 'notificas.com.ar' ||
    host === 'www.notificas.com.ar' ||
    host === 'notificas.com' ||
    host === 'www.notificas.com'
  ) {
    return PUBLIC_READER_ORIGIN;
  }
  const fallback = String(fallbackOrigin || '').replace(/\/$/, '');
  if (fallback.includes('hosted.app') || fallback.includes('run.app')) {
    return PUBLIC_READER_ORIGIN;
  }
  return fallback || PUBLIC_READER_ORIGIN;
}

module.exports = {
  PUBLIC_READER_ORIGIN,
  hostnameOf,
  isLinkPreviewCrawler,
  readerRedirectOrigin,
};
