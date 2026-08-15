import { NextResponse } from 'next/server';

export async function GET() {
  const raw = process.env.CAMPAIGN_WORKER_SECRET ?? '';
  return NextResponse.json({
    length: raw.length,
    trimmedLength: raw.trim().length,
    hasNewline: raw.includes('\n'),
    hasCarriageReturn: raw.includes('\r'),
    first8: raw.slice(0, 8),
    last8Codes: Array.from(raw.slice(-4)).map((c) => c.charCodeAt(0)),
  });
}
