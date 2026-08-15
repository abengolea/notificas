import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken } from '@/lib/auth-helper';
import { getAdminDb } from '@/lib/firebase-admin';
import { getOrgIfMember } from '@/lib/org-server';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const MAX_ROWS = 500;

function formatTs(v: unknown): string {
  if (!v) return '';
  if (v && typeof v === 'object' && 'toDate' in v && typeof (v as { toDate: () => Date }).toDate === 'function') {
    try { return (v as { toDate: () => Date }).toDate().toLocaleString('es-AR'); } catch { return ''; }
  }
  try { return new Date(v as string).toLocaleString('es-AR'); } catch { return ''; }
}

type EstadoFilter = 'todos' | 'enviado' | 'leido' | 'error' | 'pendiente';

export async function GET(request: NextRequest) {
  try {
    const { decoded, errorResponse } = await verifyAuthToken(request);
    if (errorResponse) return errorResponse;

    const sp = request.nextUrl.searchParams;
    const campaignId = sp.get('campaignId');
    const orgId = sp.get('orgId');
    const estadoFilter = (sp.get('estado') || 'todos') as EstadoFilter;
    const nombreFilter = (sp.get('nombre') || '').trim().toLowerCase();
    const limitParam = parseInt(sp.get('limit') || String(MAX_ROWS), 10);
    const limit = Math.min(Math.max(1, limitParam), MAX_ROWS);

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

    // Intentar obtener campaign_messages; si no hay, usar recipientData como fallback.
    const msgSnap = await db.collection('campaign_messages').where('campaignId', '==', campaignId).get();

    type Row = {
      recipientNombre: string;
      recipientEmail: string;
      recipientDni?: string;
      recipientLegajo?: string;
      recipientTelefono?: string;
      estado: string;
      enviadoAt?: unknown;
      leidoAt?: unknown;
      txHashEnvio?: string;
      txHashLectura?: string;
      waEstado?: string;
      waEntregadoAt?: unknown;
      waLeidoAt?: unknown;
      waTxEnvio?: string;
      waTxEntregado?: string;
      waTxLeido?: string;
    };

    function isSyntheticEmail(email: string) {
      return email.endsWith('@notificas.internal') || email.endsWith('@wa.internal');
    }

    let allRows: Row[];

    if (!msgSnap.empty) {
      allRows = msgSnap.docs.map((d) => {
        const m = d.data();
        return {
          recipientNombre: String(m.recipientNombre || ''),
          recipientEmail: String(m.recipientEmail || ''),
          recipientDni: m.recipientDni,
          recipientLegajo: m.recipientLegajo,
          recipientTelefono: m.recipientTelefono,
          estado: String(m.estado || ''),
          enviadoAt: m.enviadoAt,
          leidoAt: m.leidoAt,
          txHashEnvio: m.txHashEnvio || m.emailTxEnvio,
          txHashLectura: m.txHashLectura || m.emailTxLectura,
          waEstado: m.waEstado,
          waEntregadoAt: m.waEntregadoAt,
          waLeidoAt: m.waLeidoAt,
          waTxEnvio: m.waTxEnvio,
          waTxEntregado: m.waTxEntregado,
          waTxLeido: m.waTxLeido,
        };
      });
    } else {
      const recipientData = Array.isArray(campaign.recipientData) ? campaign.recipientData : [];
      allRows = recipientData.map((r: Record<string, string>) => ({
        recipientNombre: String(r.nombre || ''),
        recipientEmail: String(r.email || ''),
        recipientDni: r.dni,
        recipientLegajo: r.legajo,
        recipientTelefono: r.telefono,
        estado: 'enviado',
      }));
    }

    const filtered = allRows.filter((r) => {
      if (estadoFilter !== 'todos' && r.estado !== estadoFilter) return false;
      if (nombreFilter) {
        const haystack = `${r.recipientNombre} ${r.recipientEmail}`.toLowerCase();
        if (!haystack.includes(nombreFilter)) return false;
      }
      return true;
    });

    filtered.sort((a, b) => a.recipientNombre.localeCompare(b.recipientNombre, 'es'));

    const totalFiltrados = filtered.length;
    const truncated = filtered.slice(0, limit);

    const canal: string = campaign.canal || 'email';
    const showWa    = canal === 'whatsapp' || canal === 'ambos';
    const showEmail = canal === 'email'    || canal === 'ambos' || !canal;

    function shortTx(tx?: string) { return tx ? `${tx.slice(0, 10)}…${tx.slice(-6)}` : '—'; }

    const tableHead: string[] = ['#', 'Nombre', 'DNI', 'Legajo'];
    if (showWa)    tableHead.push('Teléfono');
    if (showEmail) tableHead.push('Estado', 'Enviado', 'Leído', 'TX envío', 'TX lectura');
    if (showWa)    tableHead.push('Estado WA', 'Entregado WA', 'Leído WA', 'TX env WA', 'TX ent WA', 'TX leí WA');

    const tableBody = truncated.map((m, i) => {
      const base = [
        String(i + 1),
        m.recipientNombre,
        m.recipientDni || '—',
        m.recipientLegajo || '—',
      ];
      if (showWa) base.push(m.recipientTelefono || '—');
      if (showEmail) {
        const emailDisplay = m.recipientEmail && !isSyntheticEmail(m.recipientEmail) ? m.recipientEmail : '—';
        base.push(
          m.estado,
          formatTs(m.enviadoAt),
          formatTs(m.leidoAt),
          shortTx(m.txHashEnvio),
          shortTx(m.txHashLectura),
        );
        void emailDisplay;
      }
      if (showWa) {
        base.push(
          m.waEstado || m.estado || '—',
          formatTs(m.waEntregadoAt),
          formatTs(m.waLeidoAt),
          shortTx(m.waTxEnvio),
          shortTx(m.waTxEntregado),
          shortTx(m.waTxLeido),
        );
      }
      return base;
    });

    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(14);
    doc.text('Notificas — Reporte legal de campaña', 14, 16);
    doc.setFontSize(10);
    doc.text(`Organización: ${orgNombre}`, 14, 24);
    doc.text(`Campaña: ${String(campaign.nombre || '')}`, 14, 30);
    doc.text(`Asunto: ${String(campaign.asunto || '')}`, 14, 36);
    const filterParts: string[] = [];
    if (estadoFilter !== 'todos') filterParts.push(`Estado: ${estadoFilter}`);
    if (nombreFilter) filterParts.push(`Nombre: "${nombreFilter}"`);
    const filterLabel = filterParts.length ? filterParts.join(' · ') : 'Sin filtros';
    doc.text(`Filtro: ${filterLabel} — ${totalFiltrados} registros${totalFiltrados > limit ? ` (mostrando ${limit} de ${totalFiltrados})` : ''}`, 14, 42);
    doc.text(`Generado: ${new Date().toLocaleString('es-AR')}`, 14, 48);

    // Contenido del mensaje enviado
    let msgY = 54;
    if (showWa && campaign.waTemplateName) {
      doc.setFontSize(9);
      doc.setTextColor(80, 80, 80);
      const vars = Array.isArray(campaign.waTemplateVariables) && campaign.waTemplateVariables.length > 0
        ? campaign.waTemplateVariables.map((v: string, i: number) => `{{${i+1}}}=${v}`).join('  ')
        : '';
      doc.text(`Template WA: ${campaign.waTemplateName}${campaign.waTemplateLang ? ` (${campaign.waTemplateLang})` : ''}${vars ? `   Variables: ${vars}` : ''}`, 14, msgY);
      msgY += 6;
      if (campaign.cuerpo) {
        const lines = doc.splitTextToSize(`Cuerpo: ${campaign.cuerpo}`, 260);
        doc.text(lines, 14, msgY);
        msgY += lines.length * 4 + 2;
      }
      doc.setTextColor(0, 0, 0);
    } else if (showEmail && campaign.asunto) {
      doc.setFontSize(9);
      doc.setTextColor(80, 80, 80);
      doc.text(`Asunto: ${campaign.asunto}`, 14, msgY);
      msgY += 6;
      doc.setTextColor(0, 0, 0);
    }

    if (totalFiltrados > limit) {
      doc.setFontSize(9);
      doc.setTextColor(180, 0, 0);
      doc.text(
        `⚠ Este PDF muestra solo los primeros ${limit} registros. Para el dataset completo usá "Descargar CSV".`,
        14, msgY
      );
      doc.setTextColor(0, 0, 0);
      msgY += 6;
    }

    autoTable(doc, {
      startY: msgY,
      head: [tableHead],
      body: tableBody,
      styles: { fontSize: 7 },
      headStyles: { fillColor: [13, 148, 136] },
    });

    const finalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 54;
    doc.setFontSize(8);
    doc.text(
      'Reporte generado por Notificas. Certificaciones verificables en https://polygonscan.com',
      14,
      finalY + 10
    );

    const out = doc.output('arraybuffer') as ArrayBuffer;
    const filename = `reporte-${estadoFilter !== 'todos' ? estadoFilter + '-' : ''}${campaignId.slice(0, 8)}.pdf`;
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
