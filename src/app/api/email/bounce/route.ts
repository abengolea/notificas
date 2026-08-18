import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { applyEmailBounceFromPayload, looksLikeBouncePayload } from "@/lib/email-bounce";

function secretOk(header: string | null): boolean {
  const expected = (
    process.env.POLYGON_CERTIFY_SECRET ||
    process.env.CAMPAIGN_WORKER_SECRET ||
    ""
  ).trim();
  const got = (header || "").trim();
  if (!expected || !got) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(got);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  if (!secretOk(request.headers.get("X-Certify-Secret"))) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  if (!looksLikeBouncePayload(body) && !body.mailId && !body.smtpMessageId && !body.messageId) {
    return NextResponse.json({ ignored: true }, { status: 200 });
  }

  const applied = await applyEmailBounceFromPayload(body);
  if (!applied) {
    return NextResponse.json({ matched: false }, { status: 200 });
  }
  return NextResponse.json({ ok: true, mailId: applied.mailId });
}
