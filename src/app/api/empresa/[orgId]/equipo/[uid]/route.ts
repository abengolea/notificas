import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { assertEmpresaAdmin } from "@/lib/empresa-auth";
import { loadEmpresaEquipo, removeEmpresaMember, updateEmpresaMember } from "@/lib/empresa-equipo-server";

const patchSchema = z.object({
  bocaId: z.string().min(1).nullable().optional(),
  addEnvios: z.number().int().min(0).max(1_000_000).optional(),
  setEnvios: z.number().int().min(0).max(1_000_000).optional(),
  estado: z.enum(["activo", "suspendido"]).optional(),
});

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ orgId: string; uid: string }> },
) {
  const { orgId, uid: memberUid } = await context.params;
  const gate = await assertEmpresaAdmin(request, orgId);
  if (gate.errorResponse) return gate.errorResponse;

  const body = await request.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const result = await updateEmpresaMember({
    orgId,
    memberUid,
    adminUid: gate.decoded!.uid,
    orgNombre: String(gate.org!.data.nombre || ""),
    bocaId: parsed.data.bocaId,
    addEnvios: parsed.data.addEnvios,
    setEnvios: parsed.data.setEnvios,
    estado: parsed.data.estado,
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const payload = await loadEmpresaEquipo(orgId, gate.decoded!.uid, true);
  return NextResponse.json({ ok: true, equipo: payload });
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ orgId: string; uid: string }> },
) {
  const { orgId, uid: memberUid } = await context.params;
  const gate = await assertEmpresaAdmin(request, orgId);
  if (gate.errorResponse) return gate.errorResponse;

  const result = await removeEmpresaMember(orgId, memberUid);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const payload = await loadEmpresaEquipo(orgId, gate.decoded!.uid, true);
  return NextResponse.json({ ok: true, equipo: payload });
}
