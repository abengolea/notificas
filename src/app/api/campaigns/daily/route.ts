import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { startCampaignTanda } from '@/lib/campaign-start-tanda';
import { campaignIsStopped } from '@/lib/campaign-daily';

function verifyWorkerSecret(request: NextRequest): boolean {
  const secret = (process.env.CAMPAIGN_WORKER_SECRET || '').trim();
  if (!secret) return false;
  return (request.headers.get('X-Worker-Secret') || '').trim() === secret;
}

export async function POST(request: NextRequest) {
  if (!verifyWorkerSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { campaignId?: string; dayKey?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const campaignId = String(body.campaignId || '');
  if (!campaignId) {
    return NextResponse.json({ error: 'campaignId requerido' }, { status: 400 });
  }

  const db = getAdminDb();
  const snap = await db.collection('campaigns').doc(campaignId).get();
  if (!snap.exists) {
    return NextResponse.json({ skipped: true, reason: 'missing' });
  }
  const campaign = snap.data()!;
  if (campaignIsStopped(campaign)) {
    return NextResponse.json({ skipped: true, reason: String(campaign.estado) });
  }

  try {
    const result = await startCampaignTanda({
      campaignId,
      requireStorage: Boolean(campaign.recipientStoragePath),
      chargeCredits: campaign.managedByAdmin !== true,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error al arrancar lote diario';
    const status = typeof (e as { status?: number }).status === 'number' ? (e as { status: number }).status : 500;
    if (status === 409) {
      return NextResponse.json({ error: msg }, { status: 500 });
    }
    return NextResponse.json({ error: msg }, { status });
  }
}
