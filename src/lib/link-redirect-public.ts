/**
 * El WebView de WhatsApp (app del celular) suele cortar un 302 hacia
 * `*.hosted.app`. WhatsApp Web usa el navegador del escritorio y sí lo sigue.
 * El reader tiene que quedar en el mismo host público que abrió el destinatario.
 */

export function isReaderCtaQuery(params: {
  get(name: string): string | null;
}): boolean {
  const msg = params.get("msg");
  const k = params.get("k");
  if (!msg || !k) return false;
  if (params.get("u")) return false;
  if (params.get("att")) return false;
  return true;
}

export function isLinkPreviewCrawler(userAgent: string | null | undefined): boolean {
  const ua = String(userAgent || "");
  if (!ua) return false;
  if (/facebookexternalhit|facebot/i.test(ua)) return true;
  return /whatsapp\//i.test(ua) && !/mozilla/i.test(ua);
}

export function readerResponseOrigin(requestOrigin: string): string {
  try {
    const host = new URL(requestOrigin).hostname.toLowerCase();
    if (
      host === "notificas.com.ar" ||
      host === "www.notificas.com.ar" ||
      host === "notificas.com" ||
      host === "www.notificas.com"
    ) {
      return "https://notificas.com.ar";
    }
    return requestOrigin.replace(/\/$/, "");
  } catch {
    return requestOrigin;
  }
}

export function readerPathFromQuery(params: {
  get(name: string): string | null;
}): string {
  const msg = String(params.get("msg") || "");
  const k = String(params.get("k") || "");
  const src = params.get("src") === "whatsapp" ? "whatsapp" : "email";
  return `/reader/${encodeURIComponent(msg)}?k=${encodeURIComponent(k)}&from=${src}`;
}

export function readerUrlOnRequestOrigin(
  requestOrigin: string,
  params: { get(name: string): string | null },
): string {
  return `${readerResponseOrigin(requestOrigin)}${readerPathFromQuery(params)}`;
}

export function rewriteLocationToRequestOrigin(
  location: string,
  requestOrigin: string,
): string {
  const origin = readerResponseOrigin(requestOrigin);
  let dest: URL;
  try {
    dest = new URL(location, origin);
  } catch {
    return location;
  }
  if (dest.pathname === "/reader" || dest.pathname.startsWith("/reader/")) {
    const publicOrigin = new URL(origin);
    dest.protocol = publicOrigin.protocol;
    dest.host = publicOrigin.host;
    return dest.toString();
  }
  return location;
}
