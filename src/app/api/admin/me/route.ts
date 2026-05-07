import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  getAdminPanelConfig,
  verifyAdminSessionToken,
} from "@/lib/admin-session";

export async function GET(request: NextRequest) {
  const cfg = getAdminPanelConfig();
  if (!cfg) {
    return NextResponse.json({ ok: false, error: "not_configured" }, { status: 503 });
  }

  const raw = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  if (
    !raw ||
    !verifyAdminSessionToken(raw, cfg.secret, cfg.email)
  ) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  return NextResponse.json({ ok: true, email: cfg.email });
}
