import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth } from "@/lib/firebase-admin";
import {
  applyAdminSessionCookie,
  getAdminPanelConfig,
  isAdminAllowedEmail,
} from "@/lib/admin-session";

export async function POST(request: NextRequest) {
  const cfg = getAdminPanelConfig();
  if (!cfg) {
    return NextResponse.json(
      {
        error:
          "Panel admin no configurado: falta ADMIN_PANEL_EMAIL, ADMIN_PANEL_PASSWORD y/o ADMIN_SESSION_SECRET en el servidor.",
      },
      { status: 500 },
    );
  }

  let body: { idToken?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const idToken = typeof body.idToken === "string" ? body.idToken.trim() : "";
  if (!idToken) {
    return NextResponse.json({ error: "Token de Google requerido" }, { status: 400 });
  }

  let decoded: { email?: string; email_verified?: boolean };
  try {
    decoded = await getAdminAuth().verifyIdToken(idToken);
  } catch {
    return NextResponse.json({ error: "Token inválido o expirado" }, { status: 401 });
  }

  const email = typeof decoded.email === "string" ? decoded.email.trim().toLowerCase() : "";
  if (!email || decoded.email_verified !== true || !isAdminAllowedEmail(email)) {
    return NextResponse.json(
      { error: "Esta cuenta de Google no tiene acceso al panel" },
      { status: 403 },
    );
  }

  const res = NextResponse.json({ ok: true, email });
  applyAdminSessionCookie(res, email, cfg.secret);
  return res;
}
