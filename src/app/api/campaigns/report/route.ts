import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { requireCampaignOrgAccess } from '@/lib/campaign-access';
import { getAdminDb } from '@/lib/firebase-admin';
import { campaignMessageMatchesSearch } from '@/lib/search-text';
import { recordIssuedDocument, sha256Hex, findLatestIssuedByCampaign } from '@/lib/issued-documents';
import { campaignVerifyRef } from '@/lib/verify-hints';
import { formatEvidenceTimestamp } from '@/lib/pdf-evidence-format';
import { splitExportError } from '@/lib/campaign-export-csv';
import { formatCsvBytes, getLatestFullExports } from '@/lib/campaign-csv-export';
import { buildCampaignReportPdf, type CampaignReportRow } from '@/lib/campaign-report-pdf';

const MAX_ROWS = 500;

type EstadoFilter = 'todos' | 'enviado' | 'leido' | 'error' | 'pendiente';

function str(v: unknown): string {
  return v == null ? '' : String(v).trim();
}

async function countWaEstado(
  db: FirebaseFirestore.Firestore,
  campaignId: string,
  estado: string
): Promise<number | null> {
  try {
    const snap = await db
      .collection('campaign_messages')
      .where('campaignId', '==', campaignId)
      .where('waEstado', '==', estado)
      .count()
      .get();
    return snap.data().count;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const campaignId = sp.get('campaignId');
    const orgId = sp.get('orgId');
    const estadoFilter = (sp.get('estado') || 'todos') as EstadoFilter;
    const nombreFilter = (sp.get('nombre') || '').trim();
    const flag = sp.get('flag') || '';
    const limitParam = parseInt(sp.get('limit') || String(MAX_ROWS), 10);
    const limit = Math.min(Math.max(1, limitParam), MAX_ROWS);

    if (!campaignId || !orgId) {
      return NextResponse.json({ error: 'campaignId y orgId requeridos' }, { status: 400 });
    }

    const denied = await requireCampaignOrgAccess(request, orgId, campaignId);
    if (denied) return denied;

    const db = getAdminDb();
    const campSnap = await db.collection('campaigns').doc(campaignId).get();
    if (!campSnap.exists || String(campSnap.data()!.orgId) !== orgId) {
      return NextResponse.json({ error: 'Campaña no encontrada' }, { status: 404 });
    }

    const campaign = campSnap.data()!;
    const orgSnap = await db.collection('organizations').doc(orgId).get();
    const org = orgSnap.data() || {};
    const orgNombre = str(org.nombre);
    const orgCuit = typeof org.cuit === 'string' ? org.cuit : '';
    const canal = str(campaign.canal || 'email');
    const stats = campaign.stats && typeof campaign.stats === 'object' ? campaign.stats as Record<string, unknown> : {};

    let q: FirebaseFirestore.Query = db.collection('campaign_messages').where('campaignId', '==', campaignId);
    if (flag === 'waWmidMissing') q = q.where('waWmidMissing', '==', true);
    else if (estadoFilter !== 'todos') q = q.where('estado', '==', estadoFilter);
    q = q.orderBy('recipientNombre').limit(limit);
    const msgSnap = await q.get();

    const mapped: Array<CampaignReportRow & { searchEmail: string }> = msgSnap.docs.map((d) => {
      const m = d.data();
      const err = splitExportError(m.errorMsg || m.waError);
      return {
        notificationId: d.id,
        mailId: str(m.mailId),
        nombre: str(m.recipientNombre),
        dni: str(m.recipientDni),
        telefono: str(m.recipientTelefono),
        fechaVencimiento: str(m.recipientFecha),
        monto: str(m.recipientMonto),
        cuotas: str(m.recipientCuotas),
        enviadoAt: m.waEnviadoAt || m.enviadoAt || m.emailEnviadoAt,
        entregadoAt: m.waEntregadoAt,
        leidoAt: m.waLeidoAt || m.leidoAt,
        estado: str(m.waEstado || m.estado),
        errorCode: err.code,
        errorDetail: err.detail,
        searchEmail: str(m.recipientEmail),
      };
    });

    const filtered = mapped.filter((r) => {
      if (!nombreFilter) return true;
      return campaignMessageMatchesSearch({
        recipientNombre: r.nombre,
        recipientEmail: r.searchEmail,
        recipientDni: r.dni,
        recipientTelefono: r.telefono,
      }, nombreFilter);
    });

    const truncated = filtered.slice(0, limit);
    const rowsTotal = Number(stats.total || campaign.recipientCount || filtered.length) || filtered.length;

    let entregados: number | null = null;
    if (canal === 'whatsapp' || canal === 'ambos') {
      const [ent, lei] = await Promise.all([
        countWaEstado(db, campaignId, 'entregado'),
        countWaEstado(db, campaignId, 'leido'),
      ]);
      if (ent != null || lei != null) entregados = (ent || 0) + (lei || 0);
    }

    let templateId = '';
    let templateHash = '';
    let templateHeader = '';
    let templateBody = '';
    let templateFooter = '';
    const mailIdsToTry = truncated.map((r) => r.mailId).filter(Boolean).slice(0, 8);
    for (const mailId of mailIdsToTry) {
      const mailSnap = await db.collection('mail').doc(mailId).get();
      const snap = mailSnap.data()?.waRequestSnapshot;
      if (!snap || typeof snap !== 'object') continue;
      const rec = snap as Record<string, unknown>;
      if (!templateId) templateId = str(rec.templateId);
      if (!templateHash) templateHash = str(rec.templateHash);
      if (!templateHeader) templateHeader = str(rec.renderedHeader);
      if (!templateBody) templateBody = str(rec.templateBody);
      if (!templateFooter) templateFooter = str(rec.renderedFooter);
      if (templateBody && templateId && templateHash) break;
    }

    let csvExportHash = str(campaign.csvExportHash);
    let csvExportFileName = str(campaign.csvExportFileName);
    let csvExportVersion: number | undefined;
    let csvExportRowCount: number | undefined;
    let csvExportByteSizeLabel: string | undefined;
    let csvExportGeneratedAt: string | undefined;
    const persisted = await getLatestFullExports(db, campaignId);
    if (persisted.ready?.sha256) {
      csvExportHash = persisted.ready.sha256;
      csvExportFileName = persisted.ready.fileName || csvExportFileName;
      csvExportVersion = persisted.ready.version;
      csvExportRowCount = persisted.ready.rowCount;
      csvExportByteSizeLabel = persisted.ready.byteSize ? formatCsvBytes(persisted.ready.byteSize) : undefined;
      csvExportGeneratedAt = formatEvidenceTimestamp(persisted.ready.generatedAt);
    } else if (!csvExportHash) {
      const issuedCsv = await findLatestIssuedByCampaign(db, campaignId, 'campaign_export');
      if (issuedCsv?.hash) {
        csvExportHash = issuedCsv.hash;
        csvExportFileName = csvExportFileName || str(issuedCsv.fileName);
        await db.collection('campaigns').doc(campaignId).update({
          csvExportHash,
          csvExportFileName: csvExportFileName || FieldValue.delete(),
        }).catch(() => undefined);
      }
    }

    let sendBatches: { batchId: string; merkleRoot: string; txHash: string; leafCount?: number }[] = [];
    try {
      const batchSnap = await db
        .collection('campaigns')
        .doc(campaignId)
        .collection('integrity_batches')
        .where('kind', '==', 'send')
        .limit(20)
        .get();
      sendBatches = batchSnap.docs.map((d) => {
        const b = d.data();
        return {
          batchId: d.id,
          merkleRoot: str(b.merkleRoot),
          txHash: str(b.txHash),
          leafCount: typeof b.leafCount === 'number' ? b.leafCount : undefined,
        };
      }).filter((b) => b.merkleRoot || b.txHash);
    } catch {
      try {
        const all = await db.collection('campaigns').doc(campaignId).collection('integrity_batches').limit(40).get();
        sendBatches = all.docs
          .filter((d) => String(d.data().kind) === 'send')
          .map((d) => {
            const b = d.data();
            return {
              batchId: d.id,
              merkleRoot: str(b.merkleRoot),
              txHash: str(b.txHash),
              leafCount: typeof b.leafCount === 'number' ? b.leafCount : undefined,
            };
          })
          .filter((b) => b.merkleRoot || b.txHash);
      } catch {
        sendBatches = [];
      }
    }

    const filterParts: string[] = [];
    if (flag === 'waWmidMissing') filterParts.push('WAMID faltante');
    else if (estadoFilter !== 'todos') filterParts.push(`Estado: ${estadoFilter}`);
    if (nombreFilter) filterParts.push(`Nombre: "${nombreFilter}"`);
    const filterLabel = filterParts.length ? filterParts.join(' · ') : 'Sin filtros (muestra completa hasta el tope del PDF)';

    const vars = Array.isArray(campaign.waTemplateVariables)
      ? campaign.waTemplateVariables.map((v: string, i: number) => `{{${i + 1}}}=${v}`).join('  ')
      : '';

    const appBase = (process.env.NEXT_PUBLIC_APP_URL || 'https://notificas.com.ar').replace(/\/$/, '');
    const verifyRef = campaignVerifyRef('campaign_report', campaignId);
    const pdf = await buildCampaignReportPdf({
      orgNombre,
      orgCuit,
      campaignId,
      campaignNombre: str(campaign.nombre),
      campaignAsunto: str(campaign.asunto),
      canal,
      generatedAt: formatEvidenceTimestamp(new Date()),
      startedAt: campaign.startedAt,
      completedAt: campaign.completedAt,
      filterLabel,
      stats: {
        total: Number(stats.total || campaign.recipientCount || 0) || 0,
        enviados: Number(stats.enviados || 0) || 0,
        entregados,
        leidos: Number(stats.leidos || 0) || 0,
        errores: Number(stats.errores || 0) || 0,
        pendientes: Number(stats.pendientes || 0) || 0,
      },
      templateName: str(campaign.waTemplateName),
      templateLang: str(campaign.waTemplateLang),
      templateVariables: vars,
      templateId,
      templateHash,
      templateHeader,
      templateBody,
      templateFooter,
      sendBatches,
      csvExportHash,
      csvExportFileName,
      csvExportVersion,
      csvExportRowCount,
      csvExportByteSizeLabel,
      csvExportGeneratedAt,
      verifyRef,
      verifyCampaignUrl: `${appBase}/verify?campaignId=${encodeURIComponent(campaignId)}`,
      verifyAppBase: appBase,
      rows: truncated.map(({ searchEmail: _s, ...row }) => row),
      rowsShown: truncated.length,
      rowsTotal,
      maxRows: MAX_ROWS,
    });

    const hash = sha256Hex(pdf);
    const filename = `reporte-${estadoFilter !== 'todos' ? estadoFilter + '-' : ''}${campaignId}.pdf`;
    await recordIssuedDocument(db, {
      hash,
      kind: 'campaign_report',
      campaignId,
      orgId,
      orgNombre,
      campaignNombre: String(campaign.nombre || ''),
      fileName: filename,
    });
    return new NextResponse(pdf, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'X-Notificas-Row-Count': String(truncated.length),
        'X-Notificas-Truncated': rowsTotal > truncated.length || msgSnap.size >= limit ? '1' : '0',
        'X-Notificas-Max-Rows': String(MAX_ROWS),
      },
    });
  } catch (e) {
    console.error('GET /api/campaigns/report', e);
    return NextResponse.json({ error: 'Error al generar PDF' }, { status: 500 });
  }
}
