import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken } from '@/lib/auth-helper';
import { getAdminDb } from '@/lib/firebase-admin';
import { getOrgIfMember } from '@/lib/org-server';

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
    const { decoded, errorResponse } = await verifyAuthToken(request);
    if (errorResponse) return errorResponse;

    const campaignId = request.nextUrl.searchParams.get('campaignId');
    const orgId = request.nextUrl.searchParams.get('orgId');
    if (!campaignId || !orgId) {
      return NextResponse.json({ error: 'campaignId y orgId requeridos' }, { status: 400 });
    }

    const orgGate = await getOrgIfMember(decoded!.uid, orgId, decoded!.email);
    if (!orgGate) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

    const db = getAdminDb();
    const campSnap = await db.collection('campaigns').doc(campaignId).get();
    if (!campSnap.exists || String(campSnap.data()!.orgId) !== orgId) {
      return NextResponse.json({ error: 'Campaña no encontrada' }, { status: 404 });
    }

    const campaign = campSnap.data()!;

    // Cargar todos los campaign_messages de esta campaña.
    const msgSnap = await db
      .collection('campaign_messages')
      .where('campaignId', '==', campaignId)
      .get();

    // Recolectar mailIds para hacer join con mail docs.
    const mailIds = msgSnap.docs
      .map((d) => d.data().mailId as string | undefined)
      .filter((id): id is string => !!id);

    const mailDocs = await fetchMailDocs(db, mailIds);

    // Ordenar por email para consistencia.
    const sorted = [...msgSnap.docs].sort((a, b) =>
      String(a.data().recipientEmail || '').localeCompare(String(b.data().recipientEmail || ''))
    );

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
      'TX Polygon — envío',
      'TX Polygon — lectura',
      'Verificar en Polygonscan',
    ];

    const lines: string[] = [csvRow(HEADER)];

    sorted.forEach((d, i) => {
      const m = d.data();
      const mail = m.mailId ? (mailDocs.get(m.mailId) ?? {}) : {};

      const wamid = String(mail.tracking?.whatsappMessageId || m.txHashEnvio || '');
      const phone = String(mail.recipientPhone || m.recipientTelefono || '');
      const txEnvio = String(mail.polygonCertifications?.send || m.txHashEnvio || '');
      const txLectura = String(mail.polygonCertifications?.read || m.txHashLectura || '');
      const polygonscanUrl = txEnvio
        ? `https://polygonscan.com/tx/${txEnvio}`
        : '';

      // Estado de entrega WhatsApp desde tracking.movements del mail doc.
      const movements: { type?: string }[] = Array.isArray(mail.tracking?.movements)
        ? mail.tracking.movements
        : [];
      const waDelivery =
        movements.find((mv) => mv.type === 'whatsapp_read')?.type ||
        movements.find((mv) => mv.type === 'whatsapp_delivered')?.type ||
        movements.find((mv) => mv.type === 'whatsapp_sent')?.type ||
        '';

      lines.push(
        csvRow([
          i + 1,
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
          txEnvio,
          txLectura,
          polygonscanUrl,
        ])
      );
    });

    // BOM (﻿) para que Excel en Windows abra UTF-8 correctamente sin configuración extra.
    const csv = '﻿' + lines.join('\r\n');
    const filename = `reporte-${String(campaign.nombre || campaignId).replace(/[^a-z0-9]/gi, '-').slice(0, 40)}.csv`;

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
