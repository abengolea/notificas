import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { assertAdminSession } from "@/lib/assert-admin-session";
import { MarketingError } from "@/lib/marketing/errors";
import { createLiveRecontactStore, searchCampaignRecipients } from "@/lib/marketing/recontact";

const querySchema = z.object({
  engagementStatus: z
    .enum(["all", "opened", "not_opened", "clicked", "replied", "bounced", "unsubscribed", "failed"])
    .optional()
    .default("all"),
  limit: z.coerce.number().int().min(1).max(100).optional().default(25),
  cursor: z.string().max(400).optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> },
) {
  const denied = assertAdminSession(request);
  if (denied) return denied;
  const { campaignId } = await params;
  const parsed = querySchema.safeParse({
    engagementStatus: request.nextUrl.searchParams.get("engagementStatus") || "all",
    limit: request.nextUrl.searchParams.get("limit") || 25,
    cursor: request.nextUrl.searchParams.get("cursor") || undefined,
  });
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  try {
    const result = await searchCampaignRecipients(createLiveRecontactStore(), {
      campaignId,
      engagementStatus: parsed.data.engagementStatus,
      limit: parsed.data.limit,
      cursor: parsed.data.cursor,
    });
    return NextResponse.json(result);
  } catch (e) {
    const status = e instanceof MarketingError && e.code === "not_found" ? 404 : 500;
    console.error("GET marketing campaign recipients", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error interno" }, { status });
  }
}
