import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken } from '@/lib/auth-helper';
import { getOrgIfMember } from '@/lib/org-server';
import { getAdminDb } from '@/lib/firebase-admin';
import { verifyCampaignMessage } from '@/lib/campaign-integrity';

export async function POST(request: NextRequest) {
  const { decoded, errorResponse } = await verifyAuthToken(request);
  if (errorResponse) return errorResponse;

  let body: { campaignId?: string; orgId?: string; messageId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const campaignId = String(body.campaignId || '');
  const orgId = String(body.orgId || '');
  const messageId = String(body.messageId || '');
  if (!campaignId || !orgId || !messageId) {
    return NextResponse.json({ error: 'campaignId, orgId y messageId requeridos' }, { status: 400 });
  }

  const orgGate = await getOrgIfMember(decoded!.uid, orgId, decoded!.email);
  if (!orgGate) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const camp = await getAdminDb().collection('campaigns').doc(campaignId).get();
  if (!camp.exists || String(camp.data()?.orgId) !== orgId) {
    return NextResponse.json({ error: 'Campaña no encontrada' }, { status: 404 });
  }

  try {
    const result = await verifyCampaignMessage(campaignId, messageId);
    return NextResponse.json({ ok: true, ...result });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Error al verificar';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
