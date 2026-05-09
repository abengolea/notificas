import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  getAdminPanelConfig,
  verifyAdminSessionToken,
} from "@/lib/admin-session";
import { type MemberRow, replaceCollegeMembers } from "@/lib/colegio-discount-server";

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

  let body: { members?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  if (!Array.isArray(body.members)) {
    return NextResponse.json({ error: "members debe ser un array" }, { status: 400 });
  }

  const members: MemberRow[] = [];
  for (const row of body.members) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const email = r.email;
    const nombre = r.nombre;
    if (typeof email !== "string") continue;
    members.push({
      email,
      nombre: typeof nombre === "string" ? nombre : "",
    });
  }

  try {
    const { count } = await replaceCollegeMembers(collegeId, members);
    return NextResponse.json({
      ok: true,
      uploadedRows: count,
      memberCount: count,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("no encontrado")) {
      return NextResponse.json({ error: msg }, { status: 404 });
    }
    console.error("[admin/.../members POST]", e);
    return NextResponse.json({ error: "No se pudo guardar la lista." }, { status: 500 });
  }
}
