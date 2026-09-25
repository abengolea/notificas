import { NextRequest, NextResponse } from "next/server";
import { withLinkedInAssistantCors } from "../../_shared";

export async function OPTIONS(request: NextRequest) {
  return withLinkedInAssistantCors(new NextResponse(null, { status: 204 }), request);
}

export async function POST(request: NextRequest) {
  return withLinkedInAssistantCors(
    NextResponse.json({
      ok: true,
      message: "Sesión cerrada. Volvé a iniciar sesión para continuar.",
    }),
    request,
  );
}
