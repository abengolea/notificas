import { NextRequest, NextResponse } from "next/server";
import { assertAdminSession } from "@/lib/assert-admin-session";
import { linkedInAdminRuntime, linkedInApiError } from "../_shared";

export async function GET(request: NextRequest) {
  const denied = assertAdminSession(request);
  if (denied) return denied;

  try {
    const { service, context } = linkedInAdminRuntime();
    const page = await service.searchCampaigns(context, { archived: "exclude", limit: 100 });
    const previews = await Promise.all(page.items.map((campaign) => service.previewCampaign(context, campaign.id)));
    const metrics = previews.reduce(
      (total, preview) => ({
        prospects: total.prospects + preview.summary.total,
        connectionSent: total.connectionSent + preview.summary.connectionSent,
        connected: total.connected + preview.summary.connected,
        messageSent: total.messageSent + preview.summary.messageSent,
        replied: total.replied + preview.summary.replied,
        interested: total.interested + preview.summary.interested,
      }),
      {
        prospects: 0,
        connectionSent: 0,
        connected: 0,
        messageSent: 0,
        replied: 0,
        interested: 0,
      },
    );

    return NextResponse.json({
      campaignCount: page.items.length,
      bounded: Boolean(page.nextCursor),
      metrics,
    });
  } catch (error) {
    return linkedInApiError(error);
  }
}
