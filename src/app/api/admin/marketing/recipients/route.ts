import { NextRequest, NextResponse } from "next/server";
import { assertAdminSession } from "@/lib/assert-admin-session";
import { loadMarketingAudience } from "@/lib/marketing/audience";
import { parseRecipientSource } from "@/lib/marketing/lists";

export async function GET(request: NextRequest) {
  const denied = assertAdminSession(request);
  if (denied) return denied;
  const listId = request.nextUrl.searchParams.get("listId") || "";
  const stages = (request.nextUrl.searchParams.get("stages") || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const previewLimit = Number(request.nextUrl.searchParams.get("limit") || 80) || 80;
  try {
    const source = parseRecipientSource(listId);
    if (source.kind === "none") {
      return NextResponse.json({ total: 0, eligible: 0, skipped: 0, contacts: [] });
    }
    const audience = await loadMarketingAudience({
      source,
      includeStages: stages.length ? stages : undefined,
      previewLimit,
    });
    return NextResponse.json(audience);
  } catch (e) {
    console.error("GET marketing recipients", e);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
