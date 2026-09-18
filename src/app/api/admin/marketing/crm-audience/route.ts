import { NextRequest, NextResponse } from "next/server";
import { assertAdminSession } from "@/lib/assert-admin-session";
import { previewCrmCampaignAudience } from "@/lib/marketing/campaign-segment";
import { MarketingError } from "@/lib/marketing/errors";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const denied = assertAdminSession(request);
  if (denied) return denied;
  const countryCode = request.nextUrl.searchParams.get("countryCode") || "";
  const industryId = request.nextUrl.searchParams.get("industryId") || "";
  const useCaseIds = request.nextUrl.searchParams.get("useCaseIds") || request.nextUrl.searchParams.get("useCaseId") || "";
  const stages = (request.nextUrl.searchParams.get("stages") || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  try {
    const audience = await previewCrmCampaignAudience(
      { countryCode, industryId, useCaseIds: useCaseIds.split(",") },
      stages.length ? stages : undefined,
    );
    return NextResponse.json(audience);
  } catch (e) {
    const status = e instanceof MarketingError && e.code === "validation" ? 400 : 500;
    const msg = e instanceof Error ? e.message : "Error interno";
    console.error("GET marketing crm-audience", e);
    return NextResponse.json({ error: msg }, { status });
  }
}
