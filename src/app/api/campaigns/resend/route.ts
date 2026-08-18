import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { resolveCampaignOrgAccess } from '@/lib/campaign-access';
import { getAdminDb } from '@/lib/firebase-admin';
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
    const jsonBody = await request.json();
    const parsed = bodySchema.safeParse(jsonBody);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { campaignId, orgId, messageIds } = parsed.data;
    const access = await resolveCampaignOrgAccess(request, orgId, campaignId);
    if (!access.ok) return access.response;

    const db = getAdminDb();

    for (const mid of messageIds) {
      const ref = db.collection('campaign_messages').doc(mid);
      const snap = await ref.get();
      if (!snap.exists) continue;
      const d = snap.data()!;
      if (String(d.campaignId) !== campaignId || String(d.orgId) !== orgId) continue;
      const st = d.estado as string;
      if (st !== 'error') continue;
      await ref.update({
        estado: 'pendiente',
        errorMsg: FieldValue.delete(),
        creditApplied: false,
      });
    }

    const sendUrl = access.viaAdmin
      ? `${appBaseUrl()}/api/admin/campaigns/send`
      : `${appBaseUrl()}/api/campaigns/send`;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (access.viaAdmin) {
      const cookie = request.headers.get('cookie');
      if (cookie) headers.Cookie = cookie;
    } else {
      const authHeader = request.headers.get('Authorization');
      if (!authHeader?.startsWith('Bearer ')) {
        return NextResponse.json({ error: 'Authorization Bearer requerido' }, { status: 401 });
      }
      headers.Authorization = authHeader;
    }

    const res = await fetch(sendUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(access.viaAdmin ? { campaignId } : { campaignId, orgId }),
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
