import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth } from "@/lib/firebase-admin";
import { getAppPublicBaseUrl, sendPasswordLinkEmail } from "@/lib/send-account-setup-email";

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    let email: string | undefined;
    try {
      const decoded = await getAdminAuth().verifyIdToken(authHeader.slice("Bearer ".length).trim());
      email = decoded.email?.trim().toLowerCase();
    } catch {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    if (!email) {
      return NextResponse.json({ error: "La cuenta no tiene un correo asociado." }, { status: 400 });
    }

    const origin = request.headers.get("origin")?.replace(/\/$/, "") || "";
    const continueBase = getAppPublicBaseUrl() || origin;
    if (!continueBase) {
      return NextResponse.json(
        { error: "Falta NEXT_PUBLIC_APP_URL en el servidor para armar el enlace." },
        { status: 500 },
      );
    }

    const mailResult = await sendPasswordLinkEmail({
      kind: "reset",
      email,
      continueUrl: `${continueBase}/login`,
      createdBy: "api:send-password-reset-link",
    });

    if (!mailResult.ok) {
      console.error("[send-password-reset-link]", mailResult.error);
      return NextResponse.json(
        { error: mailResult.error || "Error al enviar el correo." },
        { status: mailResult.status || 502 },
      );
    }

    return NextResponse.json({ success: true, mailDocId: mailResult.mailDocId });
  } catch (e) {
    console.error("[send-password-reset-link]", e);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
