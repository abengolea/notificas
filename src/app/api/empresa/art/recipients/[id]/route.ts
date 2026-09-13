import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { assertEmpresaArt } from "@/lib/art/empresa-auth";
import { getRecipient } from "@/lib/art/store";
import { empresaRecipientView } from "@/lib/art/views";
import { createInvitation, adhesionInviteUrl } from "@/lib/art/invite";
import { reactivateRecipient, revokeAdhesion, suspendRecipient } from "@/lib/art/consent";
import { changeRecipientContact } from "@/lib/art/contact";
import { evaluateEligibility } from "@/lib/art/eligibility";
import { getOrCreateArtConfig } from "@/lib/art/store";
import { artModuleAvailableForOrg } from "@/lib/art/pilot";
import { artCaughtErrorResponse } from "@/lib/art/http";

export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const orgId = request.nextUrl.searchParams.get("orgId") || "";
  const gate = await assertEmpresaArt(request, orgId);
  if (gate.errorResponse) return gate.errorResponse;
  const { id } = await ctx.params;
  const rec = await getRecipient(orgId, id);
  if (!rec) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const config = await getOrCreateArtConfig(orgId);
  const eligibility = evaluateEligibility({ moduleEnabled: artModuleAvailableForOrg(orgId), recipient: rec, config });
  return NextResponse.json({ recipient: empresaRecipientView(rec), eligibility });
}

const actionSchema = z.object({
  orgId: z.string().min(1),
  action: z.enum(["invite", "suspend", "reactivate", "revoke", "change_phone", "change_email"]),
  reason: z.string().min(2).max(400).optional(),
  value: z.string().optional(),
});

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const parsed = actionSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const gate = await assertEmpresaArt(request, parsed.data.orgId);
  if (gate.errorResponse) return gate.errorResponse;
  const { id } = await ctx.params;
  const rec = await getRecipient(parsed.data.orgId, id);
  if (!rec) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const actor = gate.decoded!.email || gate.decoded!.uid;
  try {
  if (parsed.data.action === "invite") {
    const inv = await createInvitation({
      orgId: parsed.data.orgId,
      orgName: String(gate.org!.data.nombre || "ART"),
      recipient: rec,
      actor,
      send: true,
    });
    return NextResponse.json({ url: inv.url, expiresAt: inv.expiresAt, copyUrl: adhesionInviteUrl(inv.token) });
  }
  if (parsed.data.action === "suspend") {
    if (!parsed.data.reason) return NextResponse.json({ error: "reason_required" }, { status: 400 });
    await suspendRecipient({ orgId: parsed.data.orgId, recipientId: id, actor, reason: parsed.data.reason });
    return NextResponse.json({ ok: true });
  }
  if (parsed.data.action === "reactivate") {
    if (!parsed.data.reason) return NextResponse.json({ error: "reason_required" }, { status: 400 });
    await reactivateRecipient({ orgId: parsed.data.orgId, recipientId: id, actor, reason: parsed.data.reason });
    return NextResponse.json({ ok: true });
  }
  if (parsed.data.action === "revoke") {
    await revokeAdhesion({
      orgId: parsed.data.orgId,
      recipientId: id,
      actor,
      source: "empresa",
      reason: parsed.data.reason || null,
    });
    return NextResponse.json({ ok: true });
  }
  if (parsed.data.action === "change_phone" || parsed.data.action === "change_email") {
    if (!parsed.data.value) return NextResponse.json({ error: "value_required" }, { status: 400 });
    await changeRecipientContact({
      orgId: parsed.data.orgId,
      recipientId: id,
      field: parsed.data.action === "change_phone" ? "phone" : "email",
      nextValue: parsed.data.value,
      actor,
      source: "empresa",
    });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "unknown_action" }, { status: 400 });
  } catch (e) {
    const mapped = artCaughtErrorResponse(e);
    if (mapped) return mapped;
    throw e;
  }
}
