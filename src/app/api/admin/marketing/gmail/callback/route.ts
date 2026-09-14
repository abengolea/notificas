import { NextRequest, NextResponse } from "next/server";
import { assertAdminSession } from "@/lib/assert-admin-session";
import { storeGmailTokens, verifyGmailState } from "@/lib/marketing/gmail";
import { appBaseUrl } from "@/lib/marketing/tokens";

export async function GET(request: NextRequest) {
  const denied = assertAdminSession(request);
  if (denied) {
    const login = new URL("/admin/login", appBaseUrl());
    login.searchParams.set("next", "/admin/marketing");
    return NextResponse.redirect(login);
  }
  const err = request.nextUrl.searchParams.get("error");
  const code = request.nextUrl.searchParams.get("code") || "";
  const state = request.nextUrl.searchParams.get("state") || "";
  const dest = new URL("/admin/marketing", appBaseUrl());
  if (err) {
    dest.searchParams.set("gmail", "denied");
    return NextResponse.redirect(dest);
  }
  if (!code || !verifyGmailState(state)) {
    dest.searchParams.set("gmail", "invalid");
    return NextResponse.redirect(dest);
  }
  try {
    await storeGmailTokens(code);
    dest.searchParams.set("gmail", "ok");
  } catch (e) {
    dest.searchParams.set("gmail", "error");
    dest.searchParams.set("reason", e instanceof Error ? e.message.slice(0, 180) : "error");
  }
  return NextResponse.redirect(dest);
}
