import { NextRequest, NextResponse } from "next/server";
import { assertAdminSession } from "@/lib/assert-admin-session";
import { gmailStatus } from "@/lib/marketing/gmail";

export async function GET(request: NextRequest) {
  const denied = assertAdminSession(request);
  if (denied) return denied;
  try {
    return NextResponse.json(await gmailStatus());
  } catch (e) {
    console.error("GET marketing gmail", e);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
