import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  getAdminPanelConfig,
  verifyAdminSessionToken,
} from "@/lib/admin-session";
import { deleteColegioCollege, patchColegioCollege } from "@/lib/colegio-discount-server";

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

export async function PATCH(
  request: NextRequest,
  ctx: { params: Promise<{ collegeId: string }> },
) {
  const denied = assertAdmin(request);
  if (denied) return denied;
  const { collegeId } = await ctx.params;
  if (!collegeId?.trim()) {
    return NextResponse.json({ error: "collegeId requerido" }, { status: 400 });
  }

  let body: {
    enabled?: unknown;
    discountPercent?: unknown;
    nombreColegio?: unknown;
    legalmevColegioId?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const patch: {
    enabled?: boolean;
    discountPercent?: number;
    nombreColegio?: string;
    legalmevColegioId?: string | null;
  } = {};
  if (typeof body.enabled === "boolean") patch.enabled = body.enabled;
  if (body.discountPercent !== undefined) {
    const n = Number(body.discountPercent);
    if (!Number.isFinite(n)) {
      return NextResponse.json({ error: "discountPercent inválido" }, { status: 400 });
    }
    patch.discountPercent = n;
  }
  if (body.nombreColegio !== undefined) {
    if (typeof body.nombreColegio !== "string") {
      return NextResponse.json({ error: "nombreColegio debe ser texto" }, { status: 400 });
    }
    patch.nombreColegio = body.nombreColegio;
  }
  if (body.legalmevColegioId !== undefined) {
    if (body.legalmevColegioId === null) {
      patch.legalmevColegioId = null;
    } else if (typeof body.legalmevColegioId === "string") {
      patch.legalmevColegioId = body.legalmevColegioId;
    } else {
      return NextResponse.json({ error: "legalmevColegioId debe ser texto" }, { status: 400 });
    }
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 });
  }

  try {
    const college = await patchColegioCollege(collegeId, patch);
    return NextResponse.json({ college });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("no encontrado")) {
      return NextResponse.json({ error: msg }, { status: 404 });
    }
    console.error("[admin/colegio-discount/colleges PATCH]", e);
    return NextResponse.json({ error: "No se pudo guardar." }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  ctx: { params: Promise<{ collegeId: string }> },
) {
  const denied = assertAdmin(request);
  if (denied) return denied;
  const { collegeId } = await ctx.params;
  if (!collegeId?.trim()) {
    return NextResponse.json({ error: "collegeId requerido" }, { status: 400 });
  }
  try {
    await deleteColegioCollege(collegeId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("no encontrado")) {
      return NextResponse.json({ error: msg }, { status: 404 });
    }
    console.error("[admin/colegio-discount/colleges DELETE]", e);
    return NextResponse.json({ error: "No se pudo eliminar." }, { status: 500 });
  }
}
