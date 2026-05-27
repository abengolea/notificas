import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  getAdminPanelConfig,
  verifyAdminSessionToken,
} from "@/lib/admin-session";
import { findUserUidByEmail, getUserHistorial } from "@/lib/admin-users-server";

function assertAdmin(request: NextRequest): NextResponse | null {
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

export async function GET(request: NextRequest) {
  const denied = assertAdmin(request);
  if (denied) return denied;

  const uidParam = request.nextUrl.searchParams.get("uid")?.trim();
  const emailParam = request.nextUrl.searchParams.get("email")?.trim();

  let uid = uidParam || "";
  if (!uid && emailParam) {
    const found = await findUserUidByEmail(emailParam);
    if (!found) {
      return NextResponse.json({
        historial: [],
        sinCuenta: true,
        message: "Este matriculado aún no tiene cuenta en Notificas.",
      });
    }
    uid = found;
  }

  if (!uid) {
    return NextResponse.json({ error: "Indicá uid o email" }, { status: 400 });
  }

  try {
    const historial = await getUserHistorial(uid);
    return NextResponse.json({ historial, uid });
  } catch (e) {
    console.error("[admin/users/historial]", e);
    return NextResponse.json({ error: "No se pudo cargar el historial" }, { status: 500 });
  }
}
