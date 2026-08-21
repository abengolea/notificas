import { NextRequest, NextResponse } from 'next/server';
import { resolveCampaignOrgAccess } from '@/lib/campaign-access';
import { getAdminDb } from '@/lib/firebase-admin';
import { enqueueCampaignCsvExport } from '@/lib/cloud-tasks';
import {
  csvExportDocId,
  getCsvExportByDocId,
  getLatestFullExports,
  startFilteredCsvExport,
  startFullCsvExport,
  toCsvExportPublic,
} from '@/lib/campaign-csv-export';

function httpError(e: unknown): NextResponse {
  const status = typeof e === 'object' && e && 'httpStatus' in e ? Number((e as { httpStatus: number }).httpStatus) : 500;
  const message = e instanceof Error ? e.message : 'Error';
  return NextResponse.json({ error: message }, { status: status || 500 });
}

export async function GET(request: NextRequest) {
  try {
    const campaignId = request.nextUrl.searchParams.get('campaignId');
    const orgId = request.nextUrl.searchParams.get('orgId');
    const exportDocId = request.nextUrl.searchParams.get('exportDocId') || '';
    const versionParam = request.nextUrl.searchParams.get('version');
    if (!campaignId || !orgId) {
      return NextResponse.json({ error: 'campaignId y orgId requeridos' }, { status: 400 });
    }

    const access = await resolveCampaignOrgAccess(request, orgId, campaignId);
    if (!access.ok) return access.response;

    const db = getAdminDb();
    if (exportDocId) {
      const rec = await getCsvExportByDocId(db, campaignId, exportDocId);
      if (!rec) return NextResponse.json({ error: 'Export no encontrado' }, { status: 404 });
      if (rec.orgId && rec.orgId !== orgId) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
      }
      return NextResponse.json({ export: toCsvExportPublic(rec), exportDocId });
    }
    if (versionParam) {
      const rec = await getCsvExportByDocId(db, campaignId, csvExportDocId(Number(versionParam)));
      if (!rec) return NextResponse.json({ error: 'Export no encontrado' }, { status: 404 });
      return NextResponse.json({ export: toCsvExportPublic(rec), exportDocId: csvExportDocId(Number(versionParam)) });
    }

    const latest = await getLatestFullExports(db, campaignId);
    return NextResponse.json({
      latestReady: latest.ready ? toCsvExportPublic(latest.ready) : null,
      inFlight: latest.inFlight && (latest.inFlight.status === 'pending' || latest.inFlight.status === 'generating')
        ? toCsvExportPublic(latest.inFlight)
        : null,
      latestFailed: latest.failed ? toCsvExportPublic(latest.failed) : null,
      latest: latest.latest ? toCsvExportPublic(latest.latest) : null,
    });
  } catch (e) {
    console.error('GET /api/campaigns/export', e);
    return NextResponse.json({ error: 'Error al consultar el export CSV' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({})) as {
      campaignId?: string;
      orgId?: string;
      newVersion?: boolean;
      retry?: boolean;
      kind?: 'completo' | 'vista' | 'errores' | 'problemas' | 'full' | 'filtered';
      estado?: string;
      flag?: string;
      format?: 'results' | 'upload';
    };
    const campaignId = String(body.campaignId || '');
    const orgId = String(body.orgId || '');
    if (!campaignId || !orgId) {
      return NextResponse.json({ error: 'campaignId y orgId requeridos' }, { status: 400 });
    }

    const access = await resolveCampaignOrgAccess(request, orgId, campaignId);
    if (!access.ok) return access.response;
    const createdBy = access.viaAdmin ? 'admin' : (access.email || access.uid || 'user');

    const kind = body.kind || 'completo';
    if (kind === 'vista' || kind === 'errores' || kind === 'problemas' || kind === 'filtered') {
      const estado = kind === 'errores' ? 'error' : (kind === 'problemas' ? 'all' : (body.estado || 'all'));
      const flag = kind === 'problemas' ? 'problemas' : (body.flag || '');
      const format = kind === 'problemas' ? 'upload' : (body.format === 'upload' ? 'upload' : 'results');
      const started = await startFilteredCsvExport({ campaignId, orgId, createdBy, estado, flag, format });
      await enqueueCampaignCsvExport({ campaignId, exportDocId: started.exportDocId });
      return NextResponse.json({
        started: true,
        exportDocId: started.exportDocId,
        export: toCsvExportPublic(started.record),
      }, { status: 202 });
    }

    const result = await startFullCsvExport({
      campaignId,
      orgId,
      createdBy,
      newVersion: body.newVersion === true,
      retry: body.retry === true,
    });
    if (result.started) {
      try {
        await enqueueCampaignCsvExport({ campaignId, version: result.record.version });
      } catch (e) {
        console.error('No se pudo encolar export CSV', e);
        return NextResponse.json({
          error: 'El export quedó pendiente pero no se pudo encolar el worker. Reintentá.',
          export: toCsvExportPublic(result.record),
        }, { status: 503 });
      }
    }
    return NextResponse.json({
      started: result.started,
      export: toCsvExportPublic(result.record),
      exportDocId: csvExportDocId(result.record.version),
    }, { status: result.httpStatus });
  } catch (e) {
    console.error('POST /api/campaigns/export', e);
    return httpError(e);
  }
}
