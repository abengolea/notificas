import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { assertEmpresaAdmin, assertEmpresaMember } from "@/lib/empresa-auth";
import { addEmpresaMember, loadEmpresaEquipo } from "@/lib/empresa-equipo-server";

const postSchema = z.object({
  email: z.string().email(),
  nombre: z.string().min(1).max(120).optional(),
  bocaId: z.string().min(1).optional(),
  enviosIniciales: z.number().int().min(0).max(1_000_000).optional(),
});

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await context.params;
  const gate = await assertEmpresaMember(request, orgId);
  if (gate.errorResponse) return gate.errorResponse;

  const payload = await loadEmpresaEquipo(orgId, gate.decoded!.uid, gate.isAdmin);
  if (!payload) return NextResponse.json({ error: "Organización no encontrada" }, { status: 404 });
  return NextResponse.json(payload);
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await context.params;
  const gate = await assertEmpresaAdmin(request, orgId);
  if (gate.errorResponse) return gate.errorResponse;

  const body = await request.json().catch(() => ({}));
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const result = await addEmpresaMember({
    orgId,
    email: parsed.data.email,
    nombre: parsed.data.nombre,
    bocaId: parsed.data.bocaId,
    enviosIniciales: parsed.data.enviosIniciales,
    orgNombre: String(gate.org!.data.nombre || ""),
    adminUid: gate.decoded!.uid,
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const payload = await loadEmpresaEquipo(orgId, gate.decoded!.uid, true);
  return NextResponse.json({ ...result, equipo: payload });
}
