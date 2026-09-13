import { NextRequest, NextResponse } from "next/server";
import { clientIp, clientUserAgent, requireArtModule, requireArtOrg } from "@/lib/art/http";
import { resolveManageToken } from "@/lib/art/invite";
import { getRecipient } from "@/lib/art/store";
import { revokeAdhesion } from "@/lib/art/consent";
import { maskEmail, maskPhone } from "@/lib/art/mask";
import { getAdminDb } from "@/lib/firebase-admin";
import { z } from "zod";

export async function GET(_request: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const disabled = requireArtModule();
  if (disabled) return disabled;
  const { token } = await ctx.params;
  const resolved = await resolveManageToken(token);
  if (!resolved) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const orgDenied = requireArtOrg(resolved.orgId);
  if (orgDenied) return orgDenied;
  const recipient = await getRecipient(resolved.orgId, resolved.recipientId);
  if (!recipient) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const orgSnap = await getAdminDb().collection("organizations").doc(resolved.orgId).get();
  return NextResponse.json({
    art: String(orgSnap.data()?.nombre || "ART"),
    status: recipient.status,
    phone: maskPhone(recipient.phone),
    email: maskEmail(recipient.email),
    activatedAt: recipient.activatedAt,
    adhesionId: recipient.adhesionId,
  });
}

const revokeSchema = z.object({
  confirm: z.literal(true),
  reason: z.string().max(300).optional(),
});

export async function POST(request: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const disabled = requireArtModule();
  if (disabled) return disabled;
  const { token } = await ctx.params;
  const resolved = await resolveManageToken(token);
  if (!resolved) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const orgDenied = requireArtOrg(resolved.orgId);
  if (orgDenied) return orgDenied;
  const parsed = revokeSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "confirmation_required" }, { status: 400 });
  await revokeAdhesion({
    orgId: resolved.orgId,
    recipientId: resolved.recipientId,
    actor: "worker",
    source: "art_public",
    ip: clientIp(request),
    userAgent: clientUserAgent(request),
    reason: parsed.data.reason || null,
  });
  return NextResponse.json({ ok: true, status: "revoked" });
}
