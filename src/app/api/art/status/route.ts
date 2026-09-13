import { NextRequest, NextResponse } from "next/server";
import { artModuleUiHint } from "@/lib/art/enabled";
import { artModuleAvailableForOrg, evidenceRetentionUiCopy } from "@/lib/art/pilot";

export async function GET(request: NextRequest) {
  const orgId = request.nextUrl.searchParams.get("orgId") || "";
  const enabled = artModuleAvailableForOrg(orgId);
  return NextResponse.json({
    enabled,
    uiHint: artModuleUiHint() && enabled,
    retentionCopy: enabled ? evidenceRetentionUiCopy() : null,
  });
}
