import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  getAdminPanelConfig,
  verifyAdminSessionToken,
} from "@/lib/admin-session";
import { isLegalMevColegioConfigured, listLegalMevColegios } from "@/lib/legalmev-colegio-client";

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

/** Lista colegios en LegalMev para vincular ID en el admin de Notificas. */
export async function GET(request: NextRequest) {
  const denied = assertAdmin(request);
  if (denied) return denied;

  if (!isLegalMevColegioConfigured()) {
    return NextResponse.json(
      {
        error:
          "Falta LEGALMEV_URL y/o NOTIFICAS_LEGALMEV_SHARED_SECRET en el servidor.",
        colegios: [],
      },
      { status: 503 },
    );
  }

  try {
    const colegios = await listLegalMevColegios();
    return NextResponse.json({ colegios });
  } catch (e) {
    console.error("[admin/colegio-discount/legalmev-colegios]", e);
    return NextResponse.json({ error: "No se pudo consultar LegalMev." }, { status: 500 });
  }
}
