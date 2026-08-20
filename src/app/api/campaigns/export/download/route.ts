import { NextRequest, NextResponse } from 'next/server';
import { resolveCampaignOrgAccess } from '@/lib/campaign-access';
import { signCsvExportDownload } from '@/lib/campaign-csv-export';

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const campaignId = sp.get('campaignId');
    const orgId = sp.get('orgId');
    const exportDocId = sp.get('exportDocId') || undefined;
    const versionRaw = sp.get('version');
    const version = versionRaw ? Number(versionRaw) : undefined;
    if (!campaignId || !orgId) {
      return NextResponse.json({ error: 'campaignId y orgId requeridos' }, { status: 400 });
    }

    const access = await resolveCampaignOrgAccess(request, orgId, campaignId);
    if (!access.ok) return access.response;

    const signed = await signCsvExportDownload({
      campaignId,
      orgId,
      version: Number.isFinite(version) ? version : undefined,
      exportDocId,
    });
    return NextResponse.json({
      url: signed.url,
      fileName: signed.fileName,
      expiresAt: signed.expiresAt,
      sha256: signed.record.sha256,
      byteSize: signed.record.byteSize,
      rowCount: signed.record.rowCount,
      version: signed.record.version,
    });
  } catch (e) {
    const status = typeof e === 'object' && e && 'httpStatus' in e ? Number((e as { httpStatus: number }).httpStatus) : 500;
    const message = e instanceof Error ? e.message : 'Error al firmar la descarga';
    console.error('GET /api/campaigns/export/download', e);
    return NextResponse.json({ error: message }, { status: status || 500 });
  }
}
