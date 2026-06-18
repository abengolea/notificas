import { NextRequest, NextResponse } from "next/server";
import { getAdminStats } from "@/lib/admin-stats-server";
import {
  ADMIN_SESSION_COOKIE,
  getAdminPanelConfig,
  verifyAdminSessionToken,
} from "@/lib/admin-session";

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

  try {
    const payload = await getAdminStats();
    return NextResponse.json(payload);
  } catch (e) {
    console.error("[admin/stats GET]", e);
    return NextResponse.json({ error: "No se pudieron calcular las estadísticas" }, { status: 500 });
  }
}
