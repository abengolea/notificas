import { NextRequest, NextResponse } from "next/server";
import { processPublicApiSend } from "@/lib/public-api/send-worker";

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
    const body = (await request.json()) as { mailId?: string; notificationId?: string };
    if (!body.mailId || !body.notificationId) {
      return NextResponse.json({ error: "mailId and notificationId required" }, { status: 400 });
    }
    await processPublicApiSend(body.mailId, body.notificationId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("public-api send worker", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "worker_failed" }, { status: 500 });
  }
}
