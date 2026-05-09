import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { verifyAuthToken } from '@/lib/auth-helper';
import { getAdminDb } from '@/lib/firebase-admin';
import { getOrgIfMember } from '@/lib/org-server';
import { z } from 'zod';

const bodySchema = z.object({
  campaignId: z.string().min(1),
  orgId: z.string().min(1),
  messageIds: z.array(z.string()).min(1),
});

function appBaseUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:9006').replace(/\/$/, '');
}

export async function POST(request: NextRequest) {
  try {
    const { decoded, errorResponse } = await verifyAuthToken(request);
    if (errorResponse) return errorResponse;
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Authorization Bearer requerido' }, { status: 401 });
    }

    const jsonBody = await request.json();
    const parsed = bodySchema.safeParse(jsonBody);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { campaignId, orgId, messageIds } = parsed.data;
    const orgGate = await getOrgIfMember(decoded!.uid, orgId, decoded!.email);
    if (!orgGate) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

    const db = getAdminDb();
    const campSnap = await db.collection('campaigns').doc(campaignId).get();
    if (!campSnap.exists || String(campSnap.data()!.orgId) !== orgId) {
      return NextResponse.json({ error: 'Campaña no encontrada' }, { status: 404 });
    }

    for (const mid of messageIds) {
      const ref = db.collection('campaign_messages').doc(mid);
      const snap = await ref.get();
      if (!snap.exists) continue;
      const d = snap.data()!;
      if (String(d.campaignId) !== campaignId || String(d.orgId) !== orgId) continue;
      const st = d.estado as string;
      if (st !== 'error') continue;
      await ref.update({
        estado: 'error',
        errorMsg: 'Reenvío manual',
        creditApplied: false,
      });
    }

    const res = await fetch(`${appBaseUrl()}/api/campaigns/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader,
      },
      body: JSON.stringify({ campaignId, orgId }),
    });
    const text = await res.text();
    return new NextResponse(text, {
      status: res.status,
      headers: { 'Content-Type': res.headers.get('Content-Type') || 'application/json' },
    });
  } catch (e) {
    console.error('POST /api/campaigns/resend', e);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
