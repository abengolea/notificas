import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { z } from "zod";
import { assertEmpresaAdmin } from "@/lib/empresa-auth";
import { deleteBoca, loadEmpresaEquipo, upsertBoca } from "@/lib/empresa-equipo-server";

const postSchema = z.object({
  nombre: z.string().min(1).max(120),
  descripcion: z.string().max(300).optional(),
  activa: z.boolean().optional(),
});

const patchSchema = z.object({
  id: z.string().min(1),
  nombre: z.string().min(1).max(120),
  descripcion: z.string().max(300).optional(),
  activa: z.boolean().optional(),
});

const deleteSchema = z.object({
  id: z.string().min(1),
});

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await context.params;
  const gate = await assertEmpresaAdmin(request, orgId);
  if (gate.errorResponse) return gate.errorResponse;

  const payload = await loadEmpresaEquipo(orgId, gate.decoded!.uid, true);
  if (!payload) return NextResponse.json({ error: "Organización no encontrada" }, { status: 404 });
  return NextResponse.json({ bocas: payload.bocas });
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

  const result = await upsertBoca(orgId, {
    id: randomUUID(),
    nombre: parsed.data.nombre,
    descripcion: parsed.data.descripcion,
    activa: parsed.data.activa ?? true,
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const payload = await loadEmpresaEquipo(orgId, gate.decoded!.uid, true);
  return NextResponse.json({ boca: result.boca, equipo: payload });
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await context.params;
  const gate = await assertEmpresaAdmin(request, orgId);
  if (gate.errorResponse) return gate.errorResponse;

  const body = await request.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const result = await upsertBoca(orgId, {
    id: parsed.data.id,
    nombre: parsed.data.nombre,
    descripcion: parsed.data.descripcion,
    activa: parsed.data.activa ?? true,
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const payload = await loadEmpresaEquipo(orgId, gate.decoded!.uid, true);
  return NextResponse.json({ boca: result.boca, equipo: payload });
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await context.params;
  const gate = await assertEmpresaAdmin(request, orgId);
  if (gate.errorResponse) return gate.errorResponse;

  const body = await request.json().catch(() => ({}));
  const parsed = deleteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const result = await deleteBoca(orgId, parsed.data.id);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const payload = await loadEmpresaEquipo(orgId, gate.decoded!.uid, true);
  return NextResponse.json({ ok: true, equipo: payload });
}
