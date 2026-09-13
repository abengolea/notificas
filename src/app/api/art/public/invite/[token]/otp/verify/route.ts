import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isExpired } from "@/lib/art/tokens";
import { clientIp, consumeArtPublicRateLimit, requireArtModule, requireArtOrg } from "@/lib/art/http";
import { resolveInvitation } from "@/lib/art/invite";
import { verifyOtp } from "@/lib/art/otp";

const schema = z.object({
  challengeId: z.string().min(8),
  code: z.string().min(4).max(10),
});

export async function POST(request: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const disabled = requireArtModule();
  if (disabled) return disabled;
  const { token } = await ctx.params;
  const ip = clientIp(request);
  const limited = await consumeArtPublicRateLimit({ key: `otpv:${ip}`, limit: 15 });
  if (!limited.ok) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }
  const inv = await resolveInvitation(token);
  if (!inv || inv.consumed) return NextResponse.json({ error: "invalid_token" }, { status: 404 });
  const orgDenied = requireArtOrg(inv.orgId);
  if (orgDenied) return orgDenied;
  if (isExpired(inv.expiresAt)) return NextResponse.json({ error: "expired" }, { status: 410 });
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  const result = await verifyOtp({
    orgId: inv.orgId,
    recipientId: inv.recipientId,
    challengeId: parsed.data.challengeId,
    code: parsed.data.code,
    actor: "worker",
    ip,
  });
  if (!result.ok) return NextResponse.json({ error: result.reason }, { status: 400 });
  return NextResponse.json({ ok: true, purpose: result.purpose });
}
