import { NextRequest, NextResponse } from 'next/server';
import { requireCampaignOrgAccess } from '@/lib/campaign-access';
import { getAdminDb } from '@/lib/firebase-admin';

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

/** Lee mail docs en paralelo, en chunks de 100 para no saturar Firestore. */
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

export async function GET(request: NextRequest) {
  try {
    const campaignId = request.nextUrl.searchParams.get('campaignId');
    const orgId = request.nextUrl.searchParams.get('orgId');
    const asJson = request.nextUrl.searchParams.get('format') === 'json';
    if (!campaignId || !orgId) {
      return NextResponse.json({ error: 'campaignId y orgId requeridos' }, { status: 400 });
    }

    const denied = await requireCampaignOrgAccess(request, orgId, campaignId);
    if (denied) return denied;

    const db = getAdminDb();
    const campSnap = await db.collection('campaigns').doc(campaignId).get();
    const campaign = campSnap.data() || {};

    const HEADER = [
      'N°',
      'Nombre',
      'Email',
      'Teléfono',
      'DNI',
      'Legajo',
      'Estado WA/Email',
      'Estado WA entrega',
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

    const lines: string[] = [csvRow(HEADER)];
    const jsonRows: Record<string, unknown>[] = [];
    const PAGE = 200;
    let lastDoc: FirebaseFirestore.QueryDocumentSnapshot | null = null;
    let rowNum = 0;
    for (;;) {
      let q: FirebaseFirestore.Query = db
        .collection('campaign_messages')
        .where('campaignId', '==', campaignId)
        .orderBy('recipientNombre')
        .limit(PAGE);
      if (lastDoc) q = q.startAfter(lastDoc);
      const pageSnap = await q.get();
      if (pageSnap.empty) break;

      const mailIds = pageSnap.docs
        .map((d) => d.data().mailId as string | undefined)
        .filter((id): id is string => !!id);
      const mailDocs = await fetchMailDocs(db, mailIds);

      for (const d of pageSnap.docs) {
        const m = d.data();
        const mail = m.mailId ? (mailDocs.get(m.mailId) ?? {}) : {};
        const wamid = String(mail.whatsappMessageId || mail.tracking?.whatsappMessageId || '');
        const phone = String(mail.recipientPhone || m.recipientTelefono || '');
        const txEnvio = String(
          m.integrity?.send?.txHash || mail.polygonCertifications?.send || m.txHashEnvio || ''
        );
        const txLectura = String(mail.polygonCertifications?.read || m.txHashLectura || '');
        const polygonscanUrl = txEnvio ? `https://polygonscan.com/tx/${txEnvio}` : '';
        const appBase = (process.env.NEXT_PUBLIC_APP_URL || 'https://notificas.com.ar').replace(/\/$/, '');
        const verifyUrl = `${appBase}/verify?id=${encodeURIComponent(m.mailId || d.id)}`;
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
        rowNum += 1;
        jsonRows.push({
          n: rowNum,
          nombre: m.recipientNombre || '',
          email: m.recipientEmail || '',
          telefono: phone,
          dni: m.recipientDni || '',
          legajo: m.recipientLegajo || '',
          estado: m.estado || '',
          waEntrega: waDelivery.replace('whatsapp_', ''),
          enviadoAt: formatTs(m.enviadoAt),
          leidoAt: formatTs(m.leidoAt),
          wamid,
          smtpMessageId: smtpId,
          contentHash,
          waBodyHash,
          snapshotHash,
          merkleRoot,
          txEnvio,
          txLectura,
          polygonscanUrl,
          verifyUrl,
        });
        lines.push(
          csvRow([
            rowNum,
            m.recipientNombre || '',
            m.recipientEmail || '',
            phone,
            m.recipientDni || '',
            m.recipientLegajo || '',
            m.estado || '',
            waDelivery.replace('whatsapp_', ''),
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
          ])
        );
      }
      lastDoc = pageSnap.docs[pageSnap.docs.length - 1];
      if (pageSnap.size < PAGE) break;
    }

    const baseName = `reporte-${String(campaign.nombre || campaignId).replace(/[^a-z0-9]/gi, '-').slice(0, 40)}`;
    if (asJson) {
      return NextResponse.json({
        campaignId,
        campaignNombre: campaign.nombre || '',
        exportedAt: new Date().toISOString(),
        rows: jsonRows,
      });
    }

    // BOM (﻿) para que Excel en Windows abra UTF-8 correctamente sin configuración extra.
    const csv = '﻿' + lines.join('\r\n');
    const filename = `${baseName}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (e) {
    console.error('GET /api/campaigns/export', e);
    return NextResponse.json({ error: 'Error al generar CSV' }, { status: 500 });
  }
}
