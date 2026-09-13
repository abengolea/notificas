import { NextRequest, NextResponse } from "next/server";
import { isExpired } from "@/lib/art/tokens";
import { requireArtModule, requireArtOrg } from "@/lib/art/http";
import { resolveInvitation } from "@/lib/art/invite";
import { getRecipient } from "@/lib/art/store";
import { startOrApplyIdentity } from "@/lib/art/identity-flow";

export async function POST(_request: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const disabled = requireArtModule();
  if (disabled) return disabled;
  const { token } = await ctx.params;
  const inv = await resolveInvitation(token);
  if (!inv || inv.consumed) return NextResponse.json({ error: "invalid_token" }, { status: 404 });
  const orgDenied = requireArtOrg(inv.orgId);
  if (orgDenied) return orgDenied;
  if (isExpired(inv.expiresAt)) return NextResponse.json({ error: "expired" }, { status: 410 });
  const recipient = await getRecipient(inv.orgId, inv.recipientId);
  if (!recipient) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const next = await startOrApplyIdentity({
    orgId: inv.orgId,
    recipient,
    actor: "worker",
  });
  return NextResponse.json({
    identityStatus: next.identityVerificationStatus,
    status: next.status,
    provider: next.identityProvider,
  });
}
