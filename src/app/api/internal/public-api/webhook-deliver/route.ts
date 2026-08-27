import { NextRequest, NextResponse } from "next/server";
import { deliverWebhookJob } from "@/lib/public-api/webhook-dispatch";

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
    const body = (await request.json()) as { deliveryId?: string };
    if (!body.deliveryId) {
      return NextResponse.json({ error: "deliveryId required" }, { status: 400 });
    }
    await deliverWebhookJob(body.deliveryId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("public-api webhook worker", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "worker_failed" }, { status: 500 });
  }
}
