import { NextRequest, NextResponse } from "next/server";
import { assertAdminSession } from "@/lib/assert-admin-session";
import { syncGmailReplies } from "@/lib/marketing/gmail";

export async function POST(request: NextRequest) {
  const denied = assertAdminSession(request);
  if (denied) return denied;
  try {
    const result = await syncGmailReplies();
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error interno";
    console.error("POST gmail sync", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
