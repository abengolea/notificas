import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  getAdminPanelConfig,
  verifyAdminSessionToken,
} from "@/lib/admin-session";
import { createColegioCollege, listColegioColleges } from "@/lib/colegio-discount-server";

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
    const colleges = await listColegioColleges();
    return NextResponse.json({ colleges });
  } catch (e) {
    console.error("[admin/colegio-discount/colleges GET]", e);
    return NextResponse.json({ error: "No se pudo leer la lista." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const denied = assertAdmin(request);
  if (denied) return denied;
  let body: { nombreColegio?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    /* vacío */
  }
  const nombreColegio = typeof body.nombreColegio === "string" ? body.nombreColegio : undefined;
  try {
    const row = await createColegioCollege({ nombreColegio });
    return NextResponse.json({ college: row });
  } catch (e) {
    console.error("[admin/colegio-discount/colleges POST]", e);
    return NextResponse.json({ error: "No se pudo crear el colegio." }, { status: 500 });
  }
}
