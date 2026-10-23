import { NextRequest, NextResponse } from "next/server";
import { assertAdminSession } from "@/lib/assert-admin-session";
import { runBillingHealthCheck } from "@/lib/billing-health-server";

export async function POST(request: NextRequest) {
  const denied = assertAdminSession(request);
  if (denied) return denied;

  try {
    const health = await runBillingHealthCheck();
    return NextResponse.json({ ok: health.ok, health });
  } catch (e) {
    console.error("POST /api/admin/invoices/health", e);
    return NextResponse.json({ error: "No se pudo chequear la facturación" }, { status: 500 });
  }
}
