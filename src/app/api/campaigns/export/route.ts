import { NextRequest, NextResponse } from 'next/server';
import { requireCampaignOrgAccess } from '@/lib/campaign-access';
import { getAdminDb } from '@/lib/firebase-admin';
import { recordIssuedDocument, sha256Hex } from '@/lib/issued-documents';
import {
  CAMPAIGN_EXPORT_HEADERS,
  buildCampaignExportFields,
  csvRow,
  type CampaignExportContext,
} from '@/lib/campaign-export-csv';

async function fetchMailDocs(
  db: FirebaseFirestore.Firestore,
  mailIds: string[]
): Promise<Map<string, FirebaseFirestore.DocumentData>> {
  const result = new Map<string, FirebaseFirestore.DocumentData>();
  const CHUNK = 100;
  for (let i = 0; i < mailIds.length; i += CHUNK) {
    const chunk = mailIds.slice(i, i + CHUNK);
    const snaps = await Promise.all(chunk.map((id) => db.collection('mail').doc(id).get()));
    snaps.forEach((snap) => {
      if (snap.exists) result.set(snap.id, snap.data()!);
    });
  }
  return result;
}

function messagesQuery(
  db: FirebaseFirestore.Firestore,
  campaignId: string,
  estado: string,
  flag: string,
): FirebaseFirestore.Query {
  let q: FirebaseFirestore.Query = db.collection('campaign_messages').where('campaignId', '==', campaignId);
  if (flag === 'waWmidMissing') q = q.where('waWmidMissing', '==', true);
  else if (estado && estado !== 'all' && estado !== 'todos') q = q.where('estado', '==', estado);
  return q;
}

function exportCtx(
  campaignId: string,
  campaign: FirebaseFirestore.DocumentData,
  org: FirebaseFirestore.DocumentData
): CampaignExportContext {
  const appBase = (process.env.NEXT_PUBLIC_APP_URL || 'https://notificas.com.ar').replace(/\/$/, '');
  return {
    campaignId,
    campaignNombre: String(campaign.nombre || ''),
    remitente: String(org.nombre || campaign.senderEmail || campaign.createdBy || ''),
    cuitRemitente: typeof org.cuit === 'string' ? org.cuit : '',
    canal: String(campaign.canal || ''),
    appBase,
  };
}

export async function GET(request: NextRequest) {
  try {
    const campaignId = request.nextUrl.searchParams.get('campaignId');
    const orgId = request.nextUrl.searchParams.get('orgId');
    const asJson = request.nextUrl.searchParams.get('format') === 'json';
    const estado = request.nextUrl.searchParams.get('estado') || 'all';
    const flag = request.nextUrl.searchParams.get('flag') || '';
    if (!campaignId || !orgId) {
      return NextResponse.json({ error: 'campaignId y orgId requeridos' }, { status: 400 });
    }

    const denied = await requireCampaignOrgAccess(request, orgId, campaignId);
    if (denied) return denied;

    const db = getAdminDb();
    const campSnap = await db.collection('campaigns').doc(campaignId).get();
    const campaign = campSnap.data() || {};
    const orgSnap = await db.collection('organizations').doc(orgId).get();
    const org = orgSnap.data() || {};
    const ctx = exportCtx(campaignId, campaign, org);
    const baseName = `reporte-${String(campaign.nombre || campaignId).replace(/[^a-z0-9]/gi, '-').slice(0, 40)}`;
    const suffix = flag === 'waWmidMissing' ? 'wamid' : (estado !== 'all' && estado !== 'todos' ? estado : 'completo');
    const filename = `${baseName}-${suffix}.csv`;
    const PAGE = 200;

    if (asJson) {
      const jsonRows: Record<string, unknown>[] = [];
      let lastDoc: FirebaseFirestore.QueryDocumentSnapshot | null = null;
      let rowNum = 0;
      for (;;) {
        let q = messagesQuery(db, campaignId, estado, flag).orderBy('recipientNombre').limit(PAGE);
        if (lastDoc) q = q.startAfter(lastDoc);
        const pageSnap = await q.get();
        if (pageSnap.empty) break;
        const mailIds = pageSnap.docs
          .map((d) => d.data().mailId as string | undefined)
          .filter((id): id is string => !!id);
        const mailDocs = await fetchMailDocs(db, mailIds);
        for (const d of pageSnap.docs) {
          rowNum += 1;
          const m = d.data();
          const mail = m.mailId ? (mailDocs.get(m.mailId) ?? {}) : {};
          const fields = buildCampaignExportFields(rowNum, d.id, m, mail, ctx);
          const row: Record<string, unknown> = {};
          CAMPAIGN_EXPORT_HEADERS.forEach((h, i) => {
            row[h] = fields[i];
          });
          jsonRows.push(row);
        }
        lastDoc = pageSnap.docs[pageSnap.docs.length - 1];
        if (pageSnap.size < PAGE) break;
      }
      return NextResponse.json({
        campaignId,
        campaignNombre: campaign.nombre || '',
        exportedAt: new Date().toISOString(),
        filter: { estado, flag },
        rows: jsonRows,
        sha256: sha256Hex(Buffer.from(JSON.stringify(jsonRows), 'utf8')),
      });
    }

    const lines: string[] = [];
    let lastDoc: FirebaseFirestore.QueryDocumentSnapshot | null = null;
    let rowNum = 0;
    for (;;) {
      let q = messagesQuery(db, campaignId, estado, flag).orderBy('recipientNombre').limit(PAGE);
      if (lastDoc) q = q.startAfter(lastDoc);
      const pageSnap = await q.get();
      if (pageSnap.empty) break;
      const mailIds = pageSnap.docs
        .map((d) => d.data().mailId as string | undefined)
        .filter((id): id is string => !!id);
      const mailDocs = await fetchMailDocs(db, mailIds);
      for (const d of pageSnap.docs) {
        rowNum += 1;
        const m = d.data();
        const mail = m.mailId ? (mailDocs.get(m.mailId) ?? {}) : {};
        lines.push(csvRow(buildCampaignExportFields(rowNum, d.id, m, mail, ctx)));
      }
      lastDoc = pageSnap.docs[pageSnap.docs.length - 1];
      if (pageSnap.size < PAGE) break;
    }

    const csv = '\uFEFF' + csvRow([...CAMPAIGN_EXPORT_HEADERS]) + '\r\n' + (lines.length ? lines.join('\r\n') + '\r\n' : '');
    const buffer = Buffer.from(csv, 'utf8');
    const hash = sha256Hex(buffer);
    await recordIssuedDocument(db, {
      hash,
      kind: 'campaign_export',
      campaignId,
      orgId,
      orgNombre: typeof campaign.orgNombre === 'string' ? campaign.orgNombre : undefined,
      campaignNombre: String(campaign.nombre || ''),
      fileName: filename,
    });

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'X-Notificas-SHA256': hash,
        'X-Notificas-Export-Kind': 'campaign_export',
      },
    });
  } catch (e) {
    console.error('GET /api/campaigns/export', e);
    return NextResponse.json({ error: 'Error al generar CSV' }, { status: 500 });
  }
}
