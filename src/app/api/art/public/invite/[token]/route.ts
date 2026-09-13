import { NextRequest, NextResponse } from "next/server";
import { isExpired } from "@/lib/art/tokens";
import { consumeArtPublicRateLimit, clientIp, clientUserAgent, requireArtModule, requireArtOrg } from "@/lib/art/http";
import { resolveInvitation } from "@/lib/art/invite";
import { getActiveTerms, getRecipient } from "@/lib/art/store";
import { publicInviteView } from "@/lib/art/views";
import { appendArtAuditEvent } from "@/lib/art/audit";
import { getAdminDb } from "@/lib/firebase-admin";

export async function GET(request: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const disabled = requireArtModule();
  if (disabled) return disabled;
  const { token } = await ctx.params;
  const ip = clientIp(request);
  const limited = await consumeArtPublicRateLimit({ key: `invite:${ip}`, limit: 30 });
  if (!limited.ok) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: { "Retry-After": String(limited.retryAfter) } });
  }
  const inv = await resolveInvitation(token);
  if (!inv) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const orgDenied = requireArtOrg(inv.orgId);
  if (orgDenied) return orgDenied;
  if (inv.consumed) return NextResponse.json({ error: "consumed" }, { status: 409 });
  if (isExpired(inv.expiresAt)) return NextResponse.json({ error: "expired" }, { status: 410 });
  const recipient = await getRecipient(inv.orgId, inv.recipientId);
  if (!recipient) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const orgSnap = await getAdminDb().collection("organizations").doc(inv.orgId).get();
  const orgName = String(orgSnap.data()?.nombre || "ART");
  const logoUrl = typeof orgSnap.data()?.logoUrl === "string" ? orgSnap.data()!.logoUrl : null;
  const terms = await getActiveTerms(inv.orgId, orgName);
  await appendArtAuditEvent({
    orgId: inv.orgId,
    recipientId: recipient.id,
    type: "LINK_OPENED",
    actor: "worker",
    source: "art_public",
    ip,
    userAgent: clientUserAgent(request),
  });
  await appendArtAuditEvent({
    orgId: inv.orgId,
    recipientId: recipient.id,
    type: "TERMS_VIEWED",
    actor: "worker",
    source: "art_public",
    ip,
  });
  return NextResponse.json(publicInviteView({
    orgName,
    orgLogoUrl: logoUrl,
    recipient,
    termsTitle: terms.title,
    termsContent: terms.content,
    termsVersion: terms.version,
    termsHash: terms.documentHash,
  }));
}
