import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken } from '@/lib/auth-helper';
import { getOrgIfMember } from '@/lib/org-server';
import { getAdminDb } from '@/lib/firebase-admin';
import { listIntegrityBatches } from '@/lib/campaign-integrity';

export async function GET(request: NextRequest) {
  const { decoded, errorResponse } = await verifyAuthToken(request);
  if (errorResponse) return errorResponse;

  const campaignId = request.nextUrl.searchParams.get('campaignId') || '';
  const orgId = request.nextUrl.searchParams.get('orgId') || '';
  if (!campaignId || !orgId) {
    return NextResponse.json({ error: 'campaignId y orgId requeridos' }, { status: 400 });
  }

  const orgGate = await getOrgIfMember(decoded!.uid, orgId, decoded!.email);
  if (!orgGate) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const camp = await getAdminDb().collection('campaigns').doc(campaignId).get();
  if (!camp.exists || String(camp.data()?.orgId) !== orgId) {
    return NextResponse.json({ error: 'Campaña no encontrada' }, { status: 404 });
  }

  const batches = await listIntegrityBatches(campaignId);
  const send = batches.filter((b) => b.kind === 'send');
  const events = batches.filter((b) => b.kind === 'event');

  return NextResponse.json({
    batches,
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
