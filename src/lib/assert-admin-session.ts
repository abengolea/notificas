import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  getAdminPanelConfig,
  verifyAdminSessionToken,
} from "@/lib/admin-session";

/** Devuelve `NextResponse` 401/503 si no hay sesión admin válida, o `null` si OK. */
export function assertAdminSession(request: NextRequest): NextResponse | null {
  const cfg = getAdminPanelConfig();
  if (!cfg) {
    return NextResponse.json(
      { error: "Panel admin no configurado en el servidor (.env.local)." },
      { status: 503 },
    );
  }
  const raw = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  if (!raw || !verifyAdminSessionToken(raw, cfg.secret, cfg.email)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  return null;
}

/** Email del admin autenticado. El cliente no elige actor ni workspace. */
export function getAdminSessionEmail(request: NextRequest): string | null {
  const cfg = getAdminPanelConfig();
  if (!cfg) return null;
  const raw = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  if (!raw || !verifyAdminSessionToken(raw, cfg.secret, cfg.email)) return null;
  return cfg.email;
}
