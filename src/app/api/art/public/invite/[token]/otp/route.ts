import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isExpired } from "@/lib/art/tokens";
import { clientIp, consumeArtPublicRateLimit, requireArtModule, requireArtOrg, artCaughtErrorResponse, pilotRecipientNotAllowedResponse } from "@/lib/art/http";
import { resolveInvitation } from "@/lib/art/invite";
import { getOrCreateArtConfig, getRecipient } from "@/lib/art/store";
import { sendOtp } from "@/lib/art/otp";
import { digitsOnly, normalizeCuil } from "@/lib/art/ids";
import { getAdminDb } from "@/lib/firebase-admin";

const schema = z.object({
  purpose: z.enum(["phone", "email"]).default("email"),
  dni: z.string().optional(),
  cuil: z.string().optional(),
  fullName: z.string().optional(),
});

export async function POST(request: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const disabled = requireArtModule();
  if (disabled) return disabled;
  const { token } = await ctx.params;
  const ip = clientIp(request);
  const limited = await consumeArtPublicRateLimit({ key: `otp:${ip}`, limit: 8 });
  if (!limited.ok) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: { "Retry-After": String(limited.retryAfter) } });
  }
  const inv = await resolveInvitation(token);
  if (!inv || inv.consumed) return NextResponse.json({ error: "invalid_token" }, { status: 404 });
  const orgDenied = requireArtOrg(inv.orgId);
  if (orgDenied) return orgDenied;
  if (isExpired(inv.expiresAt)) return NextResponse.json({ error: "expired" }, { status: 410 });
  const body = schema.parse(await request.json().catch(() => ({})));
  if (body.purpose === "phone") {
    return NextResponse.json({ error: "email_otp_only" }, { status: 400 });
  }
  const recipient = await getRecipient(inv.orgId, inv.recipientId);
  if (!recipient) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (body.dni && digitsOnly(body.dni) !== recipient.dni) {
    return NextResponse.json({ error: "identity_mismatch" }, { status: 400 });
  }
  if (body.cuil && normalizeCuil(body.cuil) !== recipient.cuil) {
    return NextResponse.json({ error: "identity_mismatch" }, { status: 400 });
  }
  const config = await getOrCreateArtConfig(inv.orgId);
  const orgSnap = await getAdminDb().collection("organizations").doc(inv.orgId).get();
  try {
    const sent = await sendOtp({
      orgId: inv.orgId,
      orgName: String(orgSnap.data()?.nombre || "ART"),
      recipient,
      purpose: body.purpose,
      channel: config.otpChannel,
      actor: "worker",
      ip,
    });
    return NextResponse.json(sent);
  } catch (e) {
    const mapped = artCaughtErrorResponse(e);
    if (mapped) return mapped;
    const code = e && typeof e === "object" && "code" in e ? String((e as { code: string }).code) : "otp_failed";
    if (code === "PILOT_RECIPIENT_NOT_ALLOWED") return pilotRecipientNotAllowedResponse();
    return NextResponse.json({ error: code }, { status: 409 });
  }
}
