import { after, NextRequest, NextResponse } from "next/server";

import {
  isLinkPreviewCrawler,
  isReaderCtaQuery,
  readerUrlOnRequestOrigin,
  rewriteLocationToRequestOrigin,
} from "@/lib/link-redirect-public";

/**
 * Enlace público bajo el dominio de la app (p. ej. notificas.com.ar/linkRedirect).
 * El CTA de WhatsApp/correo salta al reader en el MISMO host. Si reenviáramos
 * el 302 de Cloud Run hacia *.hosted.app, WhatsApp Web lo abre y la app del
 * celular no: registra "enlace pulsado" y el WebView se queda en blanco.
 */
const DEFAULT_INTERNAL =
  "https://linkredirect-ju7n3yysfq-uc.a.run.app";

function internalLinkRedirectOrigin(): string {
  const v = process.env.INTERNAL_LINK_REDIRECT_URL?.trim();
  return v && v.length > 0 ? v.replace(/\/$/, "") : DEFAULT_INTERNAL;
}

function upstreamHeaders(request: NextRequest): HeadersInit {
  const ua = request.headers.get("user-agent");
  const xf = request.headers.get("x-forwarded-for");
  const xri = request.headers.get("x-real-ip");
  return {
    ...(ua ? { "user-agent": ua } : {}),
    ...(xf ? { "x-forwarded-for": xf } : {}),
    ...(xri ? { "x-real-ip": xri } : {}),
    "x-forwarded-host":
      request.headers.get("x-forwarded-host") || request.nextUrl.host,
    host: request.nextUrl.host,
  };
}

function trackClickInBackground(request: NextRequest) {
  const internal = `${internalLinkRedirectOrigin()}${request.nextUrl.search}`;
  after(() => {
    void fetch(internal, {
      method: "GET",
      redirect: "manual",
      cache: "no-store",
      headers: upstreamHeaders(request),
    }).catch(() => {});
  });
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const origin = request.nextUrl.origin;

  if (isReaderCtaQuery(params)) {
    const readerUrl = readerUrlOnRequestOrigin(origin, params);
    if (!isLinkPreviewCrawler(request.headers.get("user-agent"))) {
      trackClickInBackground(request);
    }
    return NextResponse.redirect(readerUrl, 302);
  }

  const internal = `${internalLinkRedirectOrigin()}${request.nextUrl.search}`;

  let upstream: Response;
  try {
    upstream = await fetch(internal, {
      method: "GET",
      redirect: "manual",
      cache: "no-store",
      headers: upstreamHeaders(request),
    });
  } catch {
    return new NextResponse("Bad gateway", { status: 502 });
  }

  if (upstream.status >= 300 && upstream.status < 400) {
    const loc = upstream.headers.get("location");
    if (loc) {
      return NextResponse.redirect(
        rewriteLocationToRequestOrigin(loc, origin),
        upstream.status,
      );
    }
  }

  if (upstream.status === 400) {
    const t = await upstream.text();
    return new NextResponse(t || "Missing params", { status: 400 });
  }

  return new NextResponse("Bad gateway", { status: 502 });
}
