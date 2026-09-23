import { NextRequest, NextResponse } from "next/server";
import { assertAdminSession } from "@/lib/assert-admin-session";
import { linkedInAdminRuntime, linkedInApiError } from "../../../_shared";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> },
) {
  const denied = assertAdminSession(request);
  if (denied) return denied;
  try {
    const { campaignId } = await params;
    const { service, context } = linkedInAdminRuntime();
    return NextResponse.json(await service.previewCampaign(context, campaignId));
  } catch (error) {
    return linkedInApiError(error);
  }
}
