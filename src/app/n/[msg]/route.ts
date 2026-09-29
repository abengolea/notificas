import { after, NextRequest, NextResponse } from "next/server";

import { getAdminDb } from "@/lib/firebase-admin";
import { isLinkPreviewCrawler } from "@/lib/link-redirect-public";
import { READ_CODES_COLLECTION, parseReadCodeDoc } from "@/lib/read-code";
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

async function resolveShortRead(code: string): Promise<{ mailId: string; token: string } | null> {
  const snap = await getAdminDb().collection(READ_CODES_COLLECTION).doc(code).get();
  if (!snap.exists) return null;
  return parseReadCodeDoc(snap.data());
}

/** https://notificas.com.ar/n/{code} — o el link viejo /n/{id}?k=... */
export async function GET(request: NextRequest, context: Ctx) {
  const { msg } = await context.params;
  const k = request.nextUrl.searchParams.get("k");
  let mailId = msg;
  let token = k;

  if (!msg) {
    return new NextResponse("Enlace incompleto", { status: 400 });
  }

  if (!token) {
    try {
      const resolved = await resolveShortRead(msg);
      if (!resolved) {
        return new NextResponse("Enlace no encontrado", { status: 404 });
      }
      mailId = resolved.mailId;
      token = resolved.token;
    } catch {
      return new NextResponse("No se pudo abrir el enlace", { status: 502 });
    }
  }

  if (!mailId || !token) {
    return new NextResponse("Enlace incompleto", { status: 400 });
  }

  if (!isLinkPreviewCrawler(request.headers.get("user-agent"))) {
    const url = whatsappClickTrackUrl(mailId, token);
    after(() => {
      void fetch(url, { method: "GET", redirect: "manual", cache: "no-store", headers: trackHeaders(request) }).catch(
        () => {},
      );
    });
  }
  return whatsappCtaPageResponse(request, mailId, token);
}
