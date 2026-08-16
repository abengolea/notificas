import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken } from '@/lib/auth-helper';
import { getOrgIfMember } from '@/lib/org-server';
import { getAdminDb } from '@/lib/firebase-admin';
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
    const { decoded, errorResponse } = await verifyAuthToken(request);
    if (errorResponse) return errorResponse;
    const orgId = String(body.orgId || '');
    if (!orgId) return NextResponse.json({ error: 'orgId requerido' }, { status: 400 });
    const orgGate = await getOrgIfMember(decoded!.uid, orgId, decoded!.email);
    if (!orgGate) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    const camp = await getAdminDb().collection('campaigns').doc(campaignId).get();
    if (!camp.exists || String(camp.data()?.orgId) !== orgId) {
      return NextResponse.json({ error: 'Campaña no encontrada' }, { status: 404 });
    }
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
