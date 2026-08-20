import { NextRequest, NextResponse } from 'next/server';
import { csvExportDocId, runCsvExportJob } from '@/lib/campaign-csv-export';

export const maxDuration = 3600;
export const runtime = 'nodejs';

function verifyWorkerSecret(request: NextRequest): boolean {
  const secret = (process.env.CAMPAIGN_WORKER_SECRET || '').trim();
  if (!secret) return false;
  return (request.headers.get('X-Worker-Secret') || '').trim() === secret;
}

export async function POST(request: NextRequest) {
  if (!verifyWorkerSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = await request.json() as {
      campaignId?: string;
      version?: number;
      exportDocId?: string;
    };
    const campaignId = String(body.campaignId || '');
    if (!campaignId) {
      return NextResponse.json({ error: 'campaignId requerido' }, { status: 400 });
    }
    const exportDocId = body.exportDocId || (body.version ? csvExportDocId(body.version) : '');
    if (!exportDocId) {
      return NextResponse.json({ error: 'version o exportDocId requerido' }, { status: 400 });
    }
    const rec = await runCsvExportJob({
      campaignId,
      version: body.version,
      exportDocId,
    });
    return NextResponse.json({
      ok: true,
      status: rec.status,
      version: rec.version,
      sha256: rec.sha256,
      rowCount: rec.rowCount,
      byteSize: rec.byteSize,
      mailReads: rec.mailReads,
      mailFetchMs: rec.mailFetchMs,
      messageReads: rec.messageReads,
      durationMs: rec.durationMs,
    });
  } catch (e) {
    console.error('POST /api/campaigns/export/worker', e);
    return NextResponse.json({
      ok: false,
      error: e instanceof Error ? e.message : 'Error al generar CSV',
    }, { status: 500 });
  }
}
