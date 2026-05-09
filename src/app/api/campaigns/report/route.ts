import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken } from '@/lib/auth-helper';
import { getAdminDb } from '@/lib/firebase-admin';
import { getOrgIfMember } from '@/lib/org-server';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

function formatTs(v: unknown): string {
  if (!v) return '';
  if (v && typeof v === 'object' && 'toDate' in v && typeof (v as { toDate: () => Date }).toDate === 'function') {
    try {
      return (v as { toDate: () => Date }).toDate().toLocaleString('es-AR');
    } catch {
      return '';
    }
  }
  try {
    return new Date(v as string).toLocaleString('es-AR');
  } catch {
    return '';
  }
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
    const orgSnap = await db.collection('organizations').doc(orgId).get();
    const orgNombre = orgSnap.exists ? String(orgSnap.data()!.nombre || '') : '';

    const msgSnap = await db.collection('campaign_messages').where('campaignId', '==', campaignId).get();

    const sortedDocs = [...msgSnap.docs].sort((a, b) =>
      String(a.data().recipientEmail || '').localeCompare(String(b.data().recipientEmail || ''))
    );

    const rows = sortedDocs.map((d, i) => {
      const m = d.data();
      return [
        String(i + 1),
        String(m.recipientNombre || ''),
        String(m.recipientEmail || ''),
        String(m.recipientDni || ''),
        String(m.recipientLegajo || ''),
        String(m.estado || ''),
        formatTs(m.enviadoAt),
        formatTs(m.leidoAt),
        String(m.txHashEnvio || ''),
        String(m.txHashLectura || ''),
      ];
    });

    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(14);
    doc.text('Notificas — Reporte legal de campaña', 14, 16);
    doc.setFontSize(10);
    doc.text(`Organización: ${orgNombre}`, 14, 24);
    doc.text(`Campaña: ${String(campaign.nombre || '')}`, 14, 30);
    doc.text(`Asunto: ${String(campaign.asunto || '')}`, 14, 36);
    doc.text(`Generado: ${new Date().toLocaleString('es-AR')}`, 14, 42);

    autoTable(doc, {
      startY: 48,
      head: [
        [
          '#',
          'Nombre',
          'Email',
          'DNI',
          'Legajo',
          'Estado',
          'Enviado',
          'Leído',
          'TX envío',
          'TX lectura',
        ],
      ],
      body: rows,
      styles: { fontSize: 7 },
      headStyles: { fillColor: [13, 148, 136] },
    });

    const finalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 48;
    doc.setFontSize(8);
    doc.text(
      'Reporte generado por Notificas. Certificaciones verificables en https://polygonscan.com',
      14,
      finalY + 10
    );

    const out = doc.output('arraybuffer') as ArrayBuffer;
    const filename = `reporte-campana-${campaignId.slice(0, 8)}.pdf`;
    return new NextResponse(out, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (e) {
    console.error('GET /api/campaigns/report', e);
    return NextResponse.json({ error: 'Error al generar PDF' }, { status: 500 });
  }
}
