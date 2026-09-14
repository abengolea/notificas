import { NextRequest, NextResponse } from "next/server";
import { assertAdminSession } from "@/lib/assert-admin-session";
import { disconnectGmail } from "@/lib/marketing/gmail";

export async function POST(request: NextRequest) {
  const denied = assertAdminSession(request);
  if (denied) return denied;
  try {
    await disconnectGmail();
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("POST gmail disconnect", e);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
