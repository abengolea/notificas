import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { startCampaignTanda } from '@/lib/campaign-start-tanda';
import { campaignIsStopped } from '@/lib/campaign-daily';

function verifyWorkerSecret(request: NextRequest): boolean {
  const secret = (process.env.CAMPAIGN_WORKER_SECRET || '').trim();
  if (!secret) return false;
  return (request.headers.get('X-Worker-Secret') || '').trim() === secret;
}

/** Recorre campañas en envío y arranca el lote del día (red de seguridad del task de las 9:00). */
export async function POST(request: NextRequest) {
  if (!verifyWorkerSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getAdminDb();
  const snap = await db.collection('campaigns').where('estado', '==', 'enviando').limit(100).get();
  const results: Array<Record<string, unknown>> = [];

  for (const doc of snap.docs) {
    const campaign = doc.data();
    if (campaignIsStopped(campaign)) continue;
    try {
      const result = await startCampaignTanda({
        campaignId: doc.id,
        requireStorage: Boolean(campaign.recipientStoragePath),
        chargeCredits: campaign.managedByAdmin !== true,
      });
      results.push({ campaignId: doc.id, ...result });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'error';
      const status = typeof (e as { status?: number }).status === 'number' ? (e as { status: number }).status : 500;
      results.push({ campaignId: doc.id, error: msg, status });
    }
  }

  return NextResponse.json({
    ok: true,
    scanned: snap.size,
    ran: results.length,
    results,
  });
}
