import { NextRequest, NextResponse } from "next/server";
import {
  applyAdminSessionCookie,
  getAdminPanelConfig,
} from "@/lib/admin-session";

export async function POST(request: NextRequest) {
  const cfg = getAdminPanelConfig();
  if (!cfg) {
    return NextResponse.json(
      { error: "Panel admin no configurado: falta ADMIN_PANEL_EMAIL, ADMIN_PANEL_PASSWORD y/o ADMIN_SESSION_SECRET en el servidor." },
      { status: 500 },
    );
  }

  let body: { email?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password =
    typeof body.password === "string" ? body.password.trim() : "";

  if (!email || !password || email !== cfg.email || password !== cfg.password) {
    return NextResponse.json({ error: "Credenciales incorrectas" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  applyAdminSessionCookie(res, email, cfg.secret);
  return res;
}
