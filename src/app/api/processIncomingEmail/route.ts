import { NextRequest, NextResponse } from 'next/server';
import { looksLikeBouncePayload } from '@/lib/email-bounce';

function inboundOk(request: NextRequest): boolean {
  const expected = (process.env.POLYGON_CERTIFY_SECRET || '').trim();
  if (!expected) return true;
  const header = (request.headers.get('X-Certify-Secret') || '').trim();
  const token = (
    request.nextUrl.searchParams.get('token') ||
    request.nextUrl.searchParams.get('secret') ||
    ''
  ).trim();
  return header === expected || token === expected;
}

export async function POST(request: NextRequest) {
  try {
    if (!inboundOk(request)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const emailData = await request.json();
    const bounce =
      emailData &&
      typeof emailData === 'object' &&
      looksLikeBouncePayload(emailData as Record<string, unknown>);

    if (!bounce && (!emailData?.from || !emailData?.subject)) {
      return NextResponse.json({ error: 'from y subject son requeridos' }, { status: 400 });
    }

    const region = 'us-central1';
    const projectId = 'notificas-f9953';
    const functionUrl = `https://${region}-${projectId}.cloudfunctions.net/processIncomingEmail`;
    const secret = (process.env.POLYGON_CERTIFY_SECRET || '').trim();

    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(secret ? { 'X-Certify-Secret': secret } : {}),
      },
      body: JSON.stringify(emailData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Error en función de Firebase:', errorText);
      return NextResponse.json({ error: 'Error al procesar correo entrante' }, { status: 500 });
    }

    const result = await response.json();
    return NextResponse.json(result);
  } catch (error) {
    console.error('❌ Error en endpoint processIncomingEmail:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
