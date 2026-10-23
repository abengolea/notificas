import { NextRequest, NextResponse } from "next/server";
import { runBillingHealthCheck } from "@/lib/billing-health-server";

function verifyWorkerSecret(request: NextRequest): boolean {
  const secret = (process.env.CAMPAIGN_WORKER_SECRET || "").trim();
  if (!secret) return false;
  return (request.headers.get("X-Worker-Secret") || "").trim() === secret;
}

export async function POST(request: NextRequest) {
  if (!verifyWorkerSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const health = await runBillingHealthCheck();
    return NextResponse.json({ ok: health.ok, health });
  } catch (e) {
    console.error("POST /api/internal/billing/health", e);
    return NextResponse.json({ error: "No se pudo chequear la facturación" }, { status: 500 });
  }
}
