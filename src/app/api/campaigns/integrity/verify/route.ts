import { NextRequest, NextResponse } from 'next/server';
import { requireCampaignOrgAccess } from '@/lib/campaign-access';
import { verifyCampaignMessage, verifyIntegrityBatch } from '@/lib/campaign-integrity';

export async function POST(request: NextRequest) {
  let body: { campaignId?: string; orgId?: string; messageId?: string; batchId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const campaignId = String(body.campaignId || '');
  const orgId = String(body.orgId || '');
  const messageId = String(body.messageId || '');
  const batchId = String(body.batchId || '');
  if (!campaignId || !orgId || (!messageId && !batchId)) {
    return NextResponse.json({ error: 'campaignId, orgId y messageId o batchId requeridos' }, { status: 400 });
  }

  const denied = await requireCampaignOrgAccess(request, orgId, campaignId);
  if (denied) return denied;

  try {
    if (batchId && !messageId) {
      const result = await verifyIntegrityBatch(campaignId, batchId);
      return NextResponse.json({ ok: true, scope: 'batch', ...result });
    }
    const result = await verifyCampaignMessage(campaignId, messageId);
    return NextResponse.json({ ok: true, scope: 'message', ...result });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Error al verificar';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
