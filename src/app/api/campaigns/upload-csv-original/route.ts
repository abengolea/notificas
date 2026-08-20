import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken } from '@/lib/auth-helper';
import { getOrgIfMember } from '@/lib/org-server';
import { sealUploadedCampaignCsv } from '@/lib/campaign-source-upload';
import { isAdminManagedCampaign, ADMIN_CAMPAIGN_READONLY_ERROR } from '@/lib/campaign-edit';
import { getAdminDb } from '@/lib/firebase-admin';

export async function POST(request: NextRequest) {
  try {
    const { decoded, errorResponse } = await verifyAuthToken(request);
    if (errorResponse) return errorResponse;

    const form = await request.formData();
    const campaignId = String(form.get('campaignId') || '').trim();
    const orgId = String(form.get('orgId') || '').trim();
    const file = form.get('file');
    if (!campaignId || !orgId) {
      return NextResponse.json({ error: 'Parámetros requeridos: campaignId, orgId' }, { status: 400 });
    }
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Archivo CSV requerido' }, { status: 400 });
    }

    const orgGate = await getOrgIfMember(decoded!.uid, orgId, decoded!.email);
    if (!orgGate) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

    const campSnap = await getAdminDb().collection('campaigns').doc(campaignId).get();
    if (campSnap.exists && isAdminManagedCampaign(campSnap.data() || {})) {
      return NextResponse.json({ error: ADMIN_CAMPAIGN_READONLY_ERROR }, { status: 403 });
    }

    return sealUploadedCampaignCsv({ orgId, campaignId, file });
  } catch (e) {
    console.error('POST /api/campaigns/upload-csv-original', e);
    return NextResponse.json({ error: 'Error al guardar el CSV original' }, { status: 500 });
  }
}
