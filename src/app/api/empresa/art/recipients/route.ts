import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { assertEmpresaArt } from "@/lib/art/empresa-auth";
import { listRecipients, upsertRecipient } from "@/lib/art/store";
import { empresaRecipientView } from "@/lib/art/views";
import { createInvitation } from "@/lib/art/invite";
import { startOrApplyIdentity } from "@/lib/art/identity-flow";
import { parseIdentityAttestation } from "@/lib/art/identity-attestation";
import { artCaughtErrorResponse } from "@/lib/art/http";
import { artPilotMode, PILOT_IDENTITY_SOURCE } from "@/lib/art/pilot";

const postSchema = z.object({
  orgId: z.string().min(1),
  cuil: z.string().min(8),
  dni: z.string().min(6),
  fullName: z.string().min(2),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  phone: z.string().min(8),
  email: z.string().email().optional().or(z.literal("")),
  externalId: z.string().optional(),
  identityPrevalidatedByArt: z.boolean().optional(),
  identityAttestation: z.record(z.string(), z.unknown()).optional(),
  sendInvite: z.boolean().optional(),
});

export async function GET(request: NextRequest) {
  const orgId = request.nextUrl.searchParams.get("orgId") || "";
  const gate = await assertEmpresaArt(request, orgId);
  if (gate.errorResponse) return gate.errorResponse;
  const status = request.nextUrl.searchParams.get("status") || undefined;
  const result = await listRecipients(orgId, { status, limit: Number(request.nextUrl.searchParams.get("limit") || 50) });
  return NextResponse.json({ recipients: result.recipients.map(empresaRecipientView) });
}

export async function POST(request: NextRequest) {
  const parsed = postSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const gate = await assertEmpresaArt(request, parsed.data.orgId);
  if (gate.errorResponse) return gate.errorResponse;
  let attestation = null;
  if (parsed.data.identityPrevalidatedByArt) {
    const att = parseIdentityAttestation(parsed.data.identityAttestation, {
      verifiedBy: gate.decoded!.email || gate.decoded!.uid,
        source: artPilotMode() ? PILOT_IDENTITY_SOURCE : "empresa_panel",
    });
    if (!att.ok) return NextResponse.json({ error: att.reason }, { status: 400 });
    attestation = att.value;
  }
  try {
  const { recipient, created } = await upsertRecipient({
    orgId: parsed.data.orgId,
    cuil: parsed.data.cuil,
    dni: parsed.data.dni,
    fullName: parsed.data.fullName,
    firstName: parsed.data.firstName,
    lastName: parsed.data.lastName,
    phone: parsed.data.phone,
    email: parsed.data.email,
    externalId: parsed.data.externalId,
    identityPrevalidatedByArt: parsed.data.identityPrevalidatedByArt,
    identityAttestation: attestation,
  });
  if (attestation) {
    await startOrApplyIdentity({
      orgId: parsed.data.orgId,
      recipient,
      attestation,
      actor: gate.decoded!.email || gate.decoded!.uid,
    });
  }
  let invite: { url: string; expiresAt: string } | null = null;
  if (parsed.data.sendInvite !== false) {
    const inv = await createInvitation({
      orgId: parsed.data.orgId,
      orgName: String(gate.org!.data.nombre || "ART"),
      recipient,
      actor: gate.decoded!.email || gate.decoded!.uid,
      send: true,
    });
    invite = { url: inv.url, expiresAt: inv.expiresAt };
  }
  return NextResponse.json({ recipient: empresaRecipientView(recipient), invite }, { status: created ? 201 : 200 });
  } catch (e) {
    const mapped = artCaughtErrorResponse(e);
    if (mapped) return mapped;
    throw e;
  }
}
