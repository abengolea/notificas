import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  getAdminPanelConfig,
  verifyAdminSessionToken,
} from "@/lib/admin-session";
import { syncColegioCollegeFromLegalMev } from "@/lib/colegio-discount-server";

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

/** Vincula el colegio con LegalMev y actualiza el conteo de matriculados desde allí. */
export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ collegeId: string }> },
) {
  const denied = assertAdmin(request);
  if (denied) return denied;

  const { collegeId } = await ctx.params;
  if (!collegeId?.trim()) {
    return NextResponse.json({ error: "collegeId requerido" }, { status: 400 });
  }

  let body: { legalmevColegioId?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    /* body vacío OK */
  }

  const legalmevColegioId =
    typeof body.legalmevColegioId === "string" ? body.legalmevColegioId.trim() : undefined;

  try {
    const college = await syncColegioCollegeFromLegalMev(collegeId, { legalmevColegioId });
    return NextResponse.json({ college });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al sincronizar con LegalMev";
    console.error("[admin/colegio-discount/sync-legalmev]", e);
    const status = msg.includes("no encontrado")
      ? 404
      : msg.includes("Falta LEGALMEV")
        ? 503
        : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
