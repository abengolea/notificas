import { NextRequest, NextResponse } from 'next/server';
import { requireCampaignOrgAccess } from '@/lib/campaign-access';
import { closeIntegrityBatch, closeOpenBatches } from '@/lib/campaign-integrity';

function verifyWorkerSecret(request: NextRequest): boolean {
  const secret = (process.env.CAMPAIGN_WORKER_SECRET || '').trim();
  if (!secret) return false;
  return (request.headers.get('X-Worker-Secret') || '').trim() === secret;
}

export async function POST(request: NextRequest) {
  let body: { campaignId?: string; batchId?: string; orgId?: string; force?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const campaignId = String(body.campaignId || '');
  if (!campaignId) {
    return NextResponse.json({ error: 'campaignId requerido' }, { status: 400 });
  }

  const isWorker = verifyWorkerSecret(request);
  if (!isWorker) {
    const orgId = String(body.orgId || '');
    if (!orgId) return NextResponse.json({ error: 'orgId requerido' }, { status: 400 });
    const denied = await requireCampaignOrgAccess(request, orgId, campaignId);
    if (denied) return denied;
  }

  try {
    if (body.batchId) {
      const result = await closeIntegrityBatch(campaignId, body.batchId, { force: Boolean(body.force) });
      return NextResponse.json({ ok: true, ...result });
    }
    const closed = await closeOpenBatches(campaignId, Boolean(body.force));
    return NextResponse.json({ ok: true, closed });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Error al cerrar tanda';
    console.error('POST /api/campaigns/integrity/close', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
