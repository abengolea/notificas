import { after, NextRequest, NextResponse } from "next/server";

import {
  isLinkPreviewCrawler,
  publicReaderOriginFromHeaders,
  readerPathFromQuery,
  whatsappReaderInterstitialHtml,
} from "@/lib/link-redirect-public";

const DEFAULT_INTERNAL = "https://linkredirect-ju7n3yysfq-uc.a.run.app";

function internalLinkRedirectOrigin(): string {
  const v = process.env.INTERNAL_LINK_REDIRECT_URL?.trim();
  return v && v.length > 0 ? v.replace(/\/$/, "") : DEFAULT_INTERNAL;
}

function upstreamHeaders(request: NextRequest): HeadersInit {
  const ua = request.headers.get("user-agent");
  const xf = request.headers.get("x-forwarded-for");
  const xri = request.headers.get("x-real-ip");
  const publicHost = new URL(publicReaderOriginFromHeaders(request.headers)).host;
  return {
    ...(ua ? { "user-agent": ua } : {}),
    ...(xf ? { "x-forwarded-for": xf } : {}),
    ...(xri ? { "x-real-ip": xri } : {}),
    "x-forwarded-host": request.headers.get("x-forwarded-host") || publicHost,
    host: publicHost,
  };
}

function trackWhatsAppClick(request: NextRequest, msg: string, k: string) {
  const qs = `?msg=${encodeURIComponent(msg)}&k=${encodeURIComponent(k)}&src=whatsapp`;
  const internal = `${internalLinkRedirectOrigin()}${qs}`;
  after(() => {
    void fetch(internal, {
      method: "GET",
      redirect: "manual",
      cache: "no-store",
      headers: upstreamHeaders(request),
    }).catch(() => {});
  });
}

export function whatsappCtaPageResponse(request: NextRequest, msg: string, k: string): NextResponse {
  const origin = publicReaderOriginFromHeaders(request.headers);
  const params = {
    get(name: string) {
      if (name === "msg") return msg;
      if (name === "k") return k;
      if (name === "src") return "whatsapp";
      return null;
    },
  };
  if (!isLinkPreviewCrawler(request.headers.get("user-agent"))) {
    trackWhatsAppClick(request, msg, k);
  }
  return new NextResponse(whatsappReaderInterstitialHtml(readerPathFromQuery(params), origin), {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "x-robots-tag": "noindex, nofollow",
    },
  });
}
