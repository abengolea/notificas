import { NextRequest, NextResponse } from "next/server";
import { assertAdminSession } from "@/lib/assert-admin-session";
import { retryFailedCampaignSends } from "@/lib/marketing/campaign-ops";
import { tickMarketingCampaign } from "@/lib/marketing/send";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> },
) {
  const denied = assertAdminSession(request);
  if (denied) return denied;
  const { campaignId } = await params;
  try {
    const retried = await retryFailedCampaignSends(campaignId);
    const tick =
      retried.retried > 0
        ? await tickMarketingCampaign(campaignId)
        : { processed: 0, remaining: 0, done: true, errors: 0 };
    return NextResponse.json({ ...retried, tick });
  } catch (e: unknown) {
    const status = typeof (e as { status?: number }).status === "number" ? (e as { status: number }).status : 500;
    const msg = e instanceof Error ? e.message : "Error interno";
    console.error("POST marketing retry campaign", e);
    return NextResponse.json({ error: msg }, { status });
  }
}
