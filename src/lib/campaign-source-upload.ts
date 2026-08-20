import { NextResponse } from 'next/server';
import {
  MAX_CAMPAIGN_SOURCE_BYTES,
  sealCampaignOriginalBytes,
} from '@/lib/campaign-recipients-storage';
import { canReplaceCampaignRecipients, CSV_REPLACE_ERROR } from '@/lib/campaign-edit';
import { getAdminDb } from '@/lib/firebase-admin';

export async function sealUploadedCampaignCsv(opts: {
  orgId: string;
  campaignId: string;
  file: File;
}): Promise<NextResponse> {
  const { orgId, campaignId, file } = opts;
  if (file.size <= 0 || file.size > MAX_CAMPAIGN_SOURCE_BYTES) {
    return NextResponse.json(
      { error: `El CSV debe pesar entre 1 byte y ${MAX_CAMPAIGN_SOURCE_BYTES / (1024 * 1024)} MB` },
      { status: 400 }
    );
  }

  const db = getAdminDb();
  const campSnap = await db.collection('campaigns').doc(campaignId).get();
  if (!campSnap.exists || String(campSnap.data()!.orgId) !== orgId) {
    return NextResponse.json({ error: 'Campaña no encontrada' }, { status: 404 });
  }
  if (!canReplaceCampaignRecipients(campSnap.data() || {})) {
    return NextResponse.json({ error: CSV_REPLACE_ERROR }, { status: 409 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const sealed = await sealCampaignOriginalBytes({
    orgId,
    campaignId,
    bytes,
    fileName: file.name || 'destinatarios.csv',
    kind: 'csv',
  });
  return NextResponse.json({ ok: true, ...sealed });
}
