import { NextRequest, NextResponse } from "next/server";

import {
  publicReaderOriginFromHeaders,
  readerPathFromQuery,
  whatsappReaderInterstitialHtml,
} from "@/lib/link-redirect-public";

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
  return new NextResponse(whatsappReaderInterstitialHtml(readerPathFromQuery(params), origin), {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "x-robots-tag": "noindex, nofollow",
    },
  });
}

export function whatsappClickTrackUrl(msg: string, k: string): string {
  const origin = (
    process.env.INTERNAL_LINK_REDIRECT_URL?.trim() ||
    "https://linkredirect-ju7n3yysfq-uc.a.run.app"
  ).replace(/\/$/, "");
  return `${origin}?msg=${encodeURIComponent(msg)}&k=${encodeURIComponent(k)}&src=whatsapp`;
}
