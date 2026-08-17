import { NextRequest, NextResponse } from 'next/server';
import { requireCampaignOrgAccess } from '@/lib/campaign-access';
import { listIntegrityBatches } from '@/lib/campaign-integrity';
import { getAdminDb } from '@/lib/firebase-admin';

export async function GET(request: NextRequest) {
  const campaignId = request.nextUrl.searchParams.get('campaignId') || '';
  const orgId = request.nextUrl.searchParams.get('orgId') || '';
  if (!campaignId || !orgId) {
    return NextResponse.json({ error: 'campaignId y orgId requeridos' }, { status: 400 });
  }

  const denied = await requireCampaignOrgAccess(request, orgId, campaignId);
  if (denied) return denied;

  const batches = await listIntegrityBatches(campaignId);
  const send = batches.filter((b) => b.kind === 'send');
  const events = batches.filter((b) => b.kind === 'event');
  const camp = await getAdminDb().collection('campaigns').doc(campaignId).get();
  const seal = camp.data()?.waTemplateSeal;

  return NextResponse.json({
    batches,
    templateSeal: seal
      ? {
          hash: String(seal.hash || ''),
          name: String(seal.templateName || ''),
          lang: String(seal.templateLang || ''),
          variables: Array.isArray(seal.templateVariables) ? seal.templateVariables : [],
          urlButton: seal.urlButton === true,
        }
      : null,
    summary: {
      sendOpen: send.filter((b) => b.status === 'open' || b.status === 'sealing' || b.status === 'failed').length,
      sendAnchored: send.filter((b) => b.status === 'anchored').length,
      eventOpen: events.filter((b) => b.status === 'open' || b.status === 'sealing' || b.status === 'failed').length,
      eventAnchored: events.filter((b) => b.status === 'anchored').length,
      leavesSend: send.reduce((n, b) => n + (b.leafCount || 0), 0),
      leavesEvent: events.reduce((n, b) => n + (b.leafCount || 0), 0),
    },
  });
}
