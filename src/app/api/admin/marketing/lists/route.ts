import { NextRequest, NextResponse } from "next/server";
import { assertAdminSession } from "@/lib/assert-admin-session";
import { loadMarketingListCatalog } from "@/lib/marketing/audience";

export async function GET(request: NextRequest) {
  const denied = assertAdminSession(request);
  if (denied) return denied;
  try {
    const lists = await loadMarketingListCatalog();
    return NextResponse.json({ lists });
  } catch (e) {
    console.error("GET marketing lists", e);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
