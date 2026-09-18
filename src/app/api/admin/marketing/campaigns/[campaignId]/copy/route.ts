import { NextRequest, NextResponse } from "next/server";
import { assertAdminSession } from "@/lib/assert-admin-session";
import { copyMarketingCampaign } from "@/lib/marketing/campaign-ops";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> },
) {
  const denied = assertAdminSession(request);
  if (denied) return denied;
  const { campaignId } = await params;
  try {
    const copied = await copyMarketingCampaign(campaignId);
    return NextResponse.json(copied, { status: 201 });
  } catch (e: unknown) {
    const status = typeof (e as { status?: number }).status === "number" ? (e as { status: number }).status : 500;
    const msg = e instanceof Error ? e.message : "Error interno";
    console.error("POST marketing copy campaign", e);
    return NextResponse.json({ error: msg }, { status });
  }
}
