import { NextRequest, NextResponse } from "next/server";
import { assertAdminSession } from "@/lib/assert-admin-session";
import { gmailConnectUrl, gmailOAuthConfigured, signGmailState } from "@/lib/marketing/gmail";

export async function GET(request: NextRequest) {
  const denied = assertAdminSession(request);
  if (denied) return denied;
  if (!gmailOAuthConfigured()) {
    return NextResponse.json(
      { error: "Faltan GOOGLE_MARKETING_OAUTH_CLIENT_ID y GOOGLE_MARKETING_OAUTH_CLIENT_SECRET" },
      { status: 503 },
    );
  }
  const url = gmailConnectUrl(signGmailState());
  return NextResponse.redirect(url);
}
