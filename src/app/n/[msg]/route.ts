import { NextRequest, NextResponse } from "next/server";

import { whatsappCtaPageResponse } from "@/lib/whatsapp-read-http";

type Ctx = { params: Promise<{ msg: string }> };

/** Link corto de lectura: https://notificas.com.ar/n/{id}?k=... */
export async function GET(request: NextRequest, context: Ctx) {
  const { msg } = await context.params;
  const k = request.nextUrl.searchParams.get("k");
  if (!msg || !k) {
    return new NextResponse("Enlace incompleto", { status: 400 });
  }
  return whatsappCtaPageResponse(request, msg, k);
}
