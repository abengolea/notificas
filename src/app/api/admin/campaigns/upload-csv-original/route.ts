import { NextRequest, NextResponse } from 'next/server';
import { assertAdminSession } from '@/lib/assert-admin-session';
import { sealUploadedCampaignCsv } from '@/lib/campaign-source-upload';

export async function POST(request: NextRequest) {
  const denied = assertAdminSession(request);
  if (denied) return denied;

  try {
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
    return sealUploadedCampaignCsv({ orgId, campaignId, file });
  } catch (e) {
    console.error('POST /api/admin/campaigns/upload-csv-original', e);
    return NextResponse.json({ error: 'Error al guardar el CSV original' }, { status: 500 });
  }
}
