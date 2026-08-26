import { NextRequest, NextResponse } from "next/server";
import { processResendWebhook } from "@/lib/resend-webhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ ok: true, service: "resend-webhook" });
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const result = await processResendWebhook({
    rawBody,
    svixId: request.headers.get("svix-id") || "",
    svixTimestamp: request.headers.get("svix-timestamp") || "",
    svixSignature: request.headers.get("svix-signature") || "",
    contentType: request.headers.get("content-type"),
  });
  return NextResponse.json(result.body, { status: result.httpStatus });
}
