/**
 * El WebView de WhatsApp (app del celular) suele cortar un 302 hacia
 * `*.hosted.app`. WhatsApp Web usa el navegador del escritorio y sí lo sigue.
 * El reader tiene que quedar en el mismo host público que abrió el destinatario.
 *
 * En App Hosting `request.nextUrl.origin` es `https://0.0.0.0:8080`.
 * El host real viene en `x-forwarded-host`.
 */

import { hostnameOf } from "./international-site";

const PUBLIC_READER_ORIGIN = "https://notificas.com.ar";

function isUnusableHost(host: string): boolean {
  return !host || /^(0\.0\.0\.0|127\.0\.0\.1|localhost|::1)$/i.test(host);
}

function firstUsableHost(headers: { get(name: string): string | null }): string {
  for (const name of ["x-forwarded-host", "x-original-host", "host"] as const) {
    const raw = headers.get(name);
    if (!raw) continue;
    const host = hostnameOf(raw.split(",")[0] ?? "");
    if (!isUnusableHost(host)) return host;
  }
  return "";
}

export function publicReaderOriginFromHeaders(headers: {
  get(name: string): string | null;
}): string {
  const host = firstUsableHost(headers);
  if (!host) return PUBLIC_READER_ORIGIN;
  return readerResponseOrigin(`https://${host}`);
}

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
    if (isUnusableHost(host)) return PUBLIC_READER_ORIGIN;
    return requestOrigin.replace(/\/$/, "");
  } catch {
    return PUBLIC_READER_ORIGIN;
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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Página 200 para el WebView de WhatsApp: no depende de que el celu siga un 302. */
export function whatsappReaderInterstitialHtml(readerPath: string): string {
  const path = readerPath.startsWith("/") ? readerPath : `/${readerPath}`;
  const href = escapeHtml(path);
  const js = JSON.stringify(path);
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="refresh" content="0;url=${href}">
  <title>Abriendo notificación</title>
  <style>
    body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
      font-family:system-ui,sans-serif;background:#f4f1ea;color:#1a1a1a;text-align:center;padding:24px}
    a{display:inline-block;margin-top:18px;padding:14px 22px;background:#111;color:#fff;
      text-decoration:none;border-radius:8px;font-weight:600}
  </style>
  <script>location.replace(${js});</script>
</head>
<body>
  <main>
    <p>Abriendo la notificación…</p>
    <a href="${href}">Abrir notificación</a>
  </main>
</body>
</html>`;
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
