import { NextRequest, NextResponse } from 'next/server';
import { requireCampaignOrgAccess } from '@/lib/campaign-access';
import { getAdminDb } from '@/lib/firebase-admin';
import { recordIssuedDocument, sha256Hex } from '@/lib/issued-documents';

function formatTs(v: unknown): string {
  if (!v) return '';
  if (v && typeof v === 'object' && 'toDate' in v) {
    try { return (v as { toDate: () => Date }).toDate().toISOString(); } catch { return ''; }
  }
  try { return new Date(v as string).toISOString(); } catch { return ''; }
}

function csvEscape(v: unknown): string {
  const s = v == null ? '' : String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function csvRow(fields: unknown[]): string {
  return fields.map(csvEscape).join(',');
}

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

const HEADER = [
  'N°',
  'Nombre',
  'Email',
  'Teléfono',
  'DNI',
  'Legajo',
  'Estado WA/Email',
  'Estado WA entrega',
  'Error',
  'Enviado (UTC)',
  'Leído (UTC)',
  'Click enlace (UTC)',
  'WAMID (WhatsApp)',
  'SMTP Message-ID',
  'Hash contenido',
  'Hash aviso WhatsApp',
  'Hash snapshot',
  'Merkle root',
  'TX Polygon — envío',
  'TX Polygon — lectura',
  'Verificar en Polygonscan',
  'Verificar en Notificas',
];

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

function rowFields(
  rowNum: number,
  m: FirebaseFirestore.DocumentData,
  mail: FirebaseFirestore.DocumentData,
  docId: string,
  mailId: string | undefined,
): unknown[] {
  const wamid = String(mail.whatsappMessageId || mail.tracking?.whatsappMessageId || '');
  const phone = String(mail.recipientPhone || m.recipientTelefono || '');
  const txEnvio = String(
    m.integrity?.send?.txHash || mail.polygonCertifications?.send || m.txHashEnvio || ''
  );
  const txLectura = String(mail.polygonCertifications?.read || m.txHashLectura || '');
  const polygonscanUrl = txEnvio ? `https://polygonscan.com/tx/${txEnvio}` : '';
  const appBase = (process.env.NEXT_PUBLIC_APP_URL || 'https://notificas.com.ar').replace(/\/$/, '');
  const verifyUrl = `${appBase}/verify?id=${encodeURIComponent(mailId || docId)}`;
  const contentHash = String(m.integrity?.send?.contentHash || mail.polygonCertifications?.contentHash || '');
  const waBodyHash = String(m.integrity?.send?.waBodyHash || mail.polygonCertifications?.waBodyHash || '');
  const snapshotHash = String(mail.evidenceSnapshotHash || '');
  const merkleRoot = String(m.integrity?.send?.merkleRoot || '');
  const smtpId = String(mail.smtpMessageId || mail.delivery?.info || '');
  const movements: { type?: string }[] = Array.isArray(mail.tracking?.movements)
    ? mail.tracking.movements
    : [];
  const waDelivery =
    movements.find((mv) => mv.type === 'whatsapp_read')?.type ||
    movements.find((mv) => mv.type === 'whatsapp_delivered')?.type ||
    movements.find((mv) => mv.type === 'whatsapp_sent')?.type ||
    '';
  return [
    rowNum,
    m.recipientNombre || '',
    m.recipientEmail || '',
    phone,
    m.recipientDni || '',
    m.recipientLegajo || '',
    m.estado || '',
    waDelivery.replace('whatsapp_', ''),
    m.errorMsg || '',
    formatTs(m.enviadoAt),
    formatTs(m.leidoAt),
    formatTs(m.waClickAt || m.emailClickAt),
    wamid,
    smtpId,
    contentHash,
    waBodyHash,
    snapshotHash,
    merkleRoot,
    txEnvio,
    txLectura,
    polygonscanUrl,
    verifyUrl,
  ];
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
          const fields = rowFields(rowNum, m, mail, d.id, m.mailId);
          jsonRows.push({
            n: fields[0],
            nombre: fields[1],
            email: fields[2],
            telefono: fields[3],
            dni: fields[4],
            legajo: fields[5],
            estado: fields[6],
            waEntrega: fields[7],
            errorMsg: fields[8],
            enviadoAt: fields[9],
            leidoAt: fields[10],
            wamid: fields[12],
          });
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
        lines.push(csvRow(rowFields(rowNum, m, mail, d.id, m.mailId)));
      }
      lastDoc = pageSnap.docs[pageSnap.docs.length - 1];
      if (pageSnap.size < PAGE) break;
    }

    const csv = '\uFEFF' + csvRow(HEADER) + '\r\n' + (lines.length ? lines.join('\r\n') + '\r\n' : '');
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
