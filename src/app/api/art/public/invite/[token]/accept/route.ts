import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isExpired } from "@/lib/art/tokens";
import { clientIp, clientUserAgent, consumeArtPublicRateLimit, requireArtModule, requireArtOrg } from "@/lib/art/http";
import { adhesionManageUrl, resolveInvitation } from "@/lib/art/invite";
import { getRecipient } from "@/lib/art/store";
import { acceptAdhesion } from "@/lib/art/consent";
import { newArtSecret } from "@/lib/art/tokens";
import { getAdminDb } from "@/lib/firebase-admin";

const schema = z.object({
  accepted: z.literal(true),
  otpChallengeId: z.string().optional().nullable(),
});

export async function POST(request: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const disabled = requireArtModule();
  if (disabled) return disabled;
  const { token } = await ctx.params;
  const ip = clientIp(request);
  const limited = await consumeArtPublicRateLimit({ key: `accept:${ip}`, limit: 10 });
  if (!limited.ok) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  const inv = await resolveInvitation(token);
  if (!inv) return NextResponse.json({ error: "invalid_token" }, { status: 404 });
  const orgDenied = requireArtOrg(inv.orgId);
  if (orgDenied) return orgDenied;
  if (isExpired(inv.expiresAt)) return NextResponse.json({ error: "expired" }, { status: 410 });
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "positive_action_required" }, { status: 400 });
  const recipient = await getRecipient(inv.orgId, inv.recipientId);
  if (!recipient) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const orgSnap = await getAdminDb().collection("organizations").doc(inv.orgId).get();
  try {
    const result = await acceptAdhesion({
      orgId: inv.orgId,
      orgName: String(orgSnap.data()?.nombre || "ART"),
      orgCuit: typeof orgSnap.data()?.cuit === "string" ? orgSnap.data()!.cuit : null,
      recipient,
      checkboxAccepted: true,
      explicitAccept: true,
      ip,
      userAgent: clientUserAgent(request),
      sessionId: newArtSecret(12),
      otpChallengeId: parsed.data.otpChallengeId || null,
      invitationTokenHash: inv.tokenHash,
    });
    return NextResponse.json({
      ok: true,
      adhesionId: result.adhesionId,
      evidenceId: result.evidenceId,
      manageUrl: adhesionManageUrl(result.manageToken),
      manageToken: result.manageToken,
    });
  } catch (e) {
    const code = e && typeof e === "object" && "code" in e ? String((e as { code: string }).code) : "accept_failed";
    const status = e && typeof e === "object" && "httpStatus" in e ? Number((e as { httpStatus: number }).httpStatus) : 409;
    return NextResponse.json({ error: code }, { status });
  }
}
