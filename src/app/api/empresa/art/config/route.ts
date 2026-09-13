import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { assertEmpresaArt } from "@/lib/art/empresa-auth";
import { getOrCreateArtConfig, updateArtConfig } from "@/lib/art/store";
import { evidenceRetentionUiCopy } from "@/lib/art/pilot";

const patchSchema = z.object({
  orgId: z.string().min(1),
  requirePhoneVerification: z.boolean().optional(),
  requireEmailVerification: z.boolean().optional(),
  requireIdentityVerification: z.boolean().optional(),
  requireLiveness: z.boolean().optional(),
  revalidateOnPhoneChange: z.boolean().optional(),
  revalidateOnEmailChange: z.boolean().optional(),
  allowPrevalidatedIdentity: z.boolean().optional(),
  identityProvider: z.enum(["ART_PREVALIDATED", "MANUAL"]).optional(),
  evidenceRetentionYears: z.number().int().min(1).max(30).optional(),
}).transform((v) => {
  const { evidenceRetentionYears: _ignored, ...rest } = v;
  return rest;
});

export async function GET(request: NextRequest) {
  const orgId = request.nextUrl.searchParams.get("orgId") || "";
  const gate = await assertEmpresaArt(request, orgId);
  if (gate.errorResponse) return gate.errorResponse;
  const config = await getOrCreateArtConfig(orgId, String(gate.org!.data.nombre || ""));
  return NextResponse.json({ config, retentionCopy: evidenceRetentionUiCopy() });
}

export async function PUT(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const gate = await assertEmpresaArt(request, parsed.data.orgId);
  if (gate.errorResponse) return gate.errorResponse;
  const { orgId, ...patch } = parsed.data;
  const config = await updateArtConfig(orgId, patch);
  return NextResponse.json({ config, retentionCopy: evidenceRetentionUiCopy() });
}
