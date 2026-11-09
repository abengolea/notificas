import { NextRequest, NextResponse } from "next/server";

import {
  publicReaderOriginFromHeaders,
  readerUrlOnRequestOrigin,
} from "@/lib/link-redirect-public";
import type { ShortReadSource } from "@/lib/short-read-source";

/** Mismo host: /n/{id} → /reader/{id}. Sin página intermedia. */
export function whatsappCtaPageResponse(
  request: NextRequest,
  msg: string,
  k: string,
  source: ShortReadSource = "whatsapp",
): NextResponse {
  const origin = publicReaderOriginFromHeaders(request.headers);
  const params = {
    get(name: string) {
      if (name === "msg") return msg;
      if (name === "k") return k;
      if (name === "src") return source;
      return null;
    },
  };
  const dest = NextResponse.redirect(readerUrlOnRequestOrigin(origin, params), 302);
  dest.headers.set("cache-control", "no-store");
  dest.headers.set("x-robots-tag", "noindex, nofollow");
  return dest;
}

export function whatsappClickTrackUrl(msg: string, k: string, source: ShortReadSource = "whatsapp"): string {
  const origin = (
    process.env.INTERNAL_LINK_REDIRECT_URL?.trim() ||
    "https://linkredirect-ju7n3yysfq-uc.a.run.app"
  ).replace(/\/$/, "");
  return `${origin}?msg=${encodeURIComponent(msg)}&k=${encodeURIComponent(k)}&src=${source}`;
}
