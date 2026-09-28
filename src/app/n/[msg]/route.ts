import { after, NextRequest, NextResponse } from "next/server";

import { isLinkPreviewCrawler } from "@/lib/link-redirect-public";
import { whatsappClickTrackUrl, whatsappCtaPageResponse } from "@/lib/whatsapp-read-http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ msg: string }> };

function trackHeaders(request: NextRequest): HeadersInit {
  const ua = request.headers.get("user-agent");
  const xf = request.headers.get("x-forwarded-for");
  const xri = request.headers.get("x-real-ip");
  return {
    ...(ua ? { "user-agent": ua } : {}),
    ...(xf ? { "x-forwarded-for": xf } : {}),
    ...(xri ? { "x-real-ip": xri } : {}),
  };
}

/** Link corto de lectura: https://notificas.com.ar/n/{id}?k=... */
export async function GET(request: NextRequest, context: Ctx) {
  const { msg } = await context.params;
  const k = request.nextUrl.searchParams.get("k");
  if (!msg || !k) {
    return new NextResponse("Enlace incompleto", { status: 400 });
  }
  if (!isLinkPreviewCrawler(request.headers.get("user-agent"))) {
    const url = whatsappClickTrackUrl(msg, k);
    after(() => {
      void fetch(url, { method: "GET", redirect: "manual", cache: "no-store", headers: trackHeaders(request) }).catch(
        () => {},
      );
    });
  }
  return whatsappCtaPageResponse(request, msg, k);
}
