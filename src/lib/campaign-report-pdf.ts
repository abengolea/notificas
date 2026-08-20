import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import QRCode from 'qrcode';
import { formatEvidenceTimestamp, PDF_SCHEMA } from '@/lib/pdf-evidence-format';
import {
  PDF_BRAND,
  PDF_MM,
  PDF_TABLE_HEAD,
  PDF_TABLE_MARGIN,
  drawPdfLetterheadMm,
  drawSoftPanelMm,
  stampPdfChromeMm,
} from '@/lib/pdf-brand';

export type CampaignReportBatch = {
  batchId: string;
  merkleRoot: string;
  txHash: string;
  leafCount?: number;
};

export type CampaignReportRow = {
  notificationId: string;
  mailId: string;
  nombre: string;
  dni: string;
  telefono: string;
  fechaVencimiento: string;
  monto: string;
  cuotas: string;
  enviadoAt?: unknown;
  entregadoAt?: unknown;
  leidoAt?: unknown;
  estado: string;
  errorCode: string;
  errorDetail: string;
};

export type CampaignReportInput = {
  orgNombre: string;
  orgCuit: string;
  campaignId: string;
  campaignNombre: string;
  campaignAsunto: string;
  canal: string;
  generatedAt: string;
  startedAt?: unknown;
  completedAt?: unknown;
  filterLabel: string;
  stats: {
    total: number;
    enviados: number;
    entregados: number | null;
    leidos: number;
    errores: number;
    pendientes: number;
  };
  templateName: string;
  templateLang: string;
  templateVariables: string;
  templateId: string;
  templateHash: string;
  sendBatches: CampaignReportBatch[];
  csvExportHash: string;
  csvExportFileName: string;
  verifyRef: string;
  verifyCampaignUrl: string;
  verifyAppBase: string;
  rows: CampaignReportRow[];
  rowsShown: number;
  rowsTotal: number;
  maxRows: number;
};

function canalLabel(canal?: string): string {
  if (canal === 'whatsapp') return 'WhatsApp';
  if (canal === 'ambos') return 'Correo electrónico y WhatsApp';
  if (canal === 'email') return 'Correo electrónico';
  return String(canal || '—');
}

function lastAutoY(doc: jsPDF, fallback: number): number {
  return (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? fallback;
}

function ensureY(doc: jsPDF, y: number, needed: number): number {
  if (y + needed > PDF_MM.contentBottom) {
    doc.addPage();
    return PDF_MM.continueTop;
  }
  return y;
}

function writeWrapped(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  maxW: number,
  lineH: number
): number {
  const lines = doc.splitTextToSize(text, maxW);
  for (const line of lines) {
    y = ensureY(doc, y, lineH + 2);
    doc.text(line, x, y);
    y += lineH;
  }
  return y;
}

function dash(v: string): string {
  return v && v.trim() ? v : '—';
}

function n(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return '—';
  return v.toLocaleString('es-AR');
}

export async function buildCampaignReportPdf(input: CampaignReportInput): Promise<ArrayBuffer> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const docTitle = 'Reporte general de campaña';
  const primaryTx = input.sendBatches.find((b) => b.txHash)?.txHash || '';
  const primaryRoot = input.sendBatches.find((b) => b.merkleRoot)?.merkleRoot || '';
  const truncated = input.rowsTotal > input.rowsShown;

  doc.setProperties({
    title: `${docTitle} — ${input.campaignNombre}`,
    subject: 'Constancia técnica de campaña de notificación digital',
    creator: 'Notificas.com',
    author: 'Notificas.com',
  });

  let y = drawPdfLetterheadMm(doc, {
    mode: 'first',
    documentTitle: docTitle,
    lines: [
      'Constancia técnica de notificación digital',
      'Identificación de la campaña, resultado, evidencia y muestra de destinatarios.',
    ],
  });
  doc.setTextColor(...PDF_BRAND.textMain);

  try {
    const qr = await QRCode.toDataURL(input.verifyCampaignUrl, { margin: 0, width: 160 });
    doc.addImage(qr, 'PNG', 176, y, 18, 18);
    doc.setFontSize(6);
    doc.setTextColor(...PDF_BRAND.textMuted);
    doc.text('Ver campaña', 177, y + 20);
    doc.setTextColor(...PDF_BRAND.textMain);
  } catch {
    /* QR opcional */
  }

  y += 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(input.campaignNombre || 'Campaña', 14, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);
  y = writeWrapped(
    doc,
    `${input.orgNombre}${input.orgCuit ? `  ·  CUIT ${input.orgCuit}` : ''}  ·  ${canalLabel(input.canal)}`,
    14,
    y,
    155,
    3.6
  );
  y += 6;

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('1. Identificación de la campaña', 14, y);
  y += 4;
  autoTable(doc, {
    startY: y,
    theme: 'plain',
    margin: PDF_TABLE_MARGIN,
    styles: { fontSize: 8, cellPadding: 1.5, textColor: PDF_BRAND.textMain },
    columnStyles: { 0: { cellWidth: 52, fontStyle: 'bold' }, 1: { cellWidth: 130 } },
    body: [
      ['Remitente', `${input.orgNombre || '—'}${input.orgCuit ? `  ·  CUIT ${input.orgCuit}` : ''}`],
      ['Campaign ID', input.campaignId],
      ['Nombre de campaña', input.campaignNombre || '—'],
      ...(input.campaignAsunto && input.canal !== 'whatsapp'
        ? [['Asunto (correo)', input.campaignAsunto]]
        : []),
      ['Canal', canalLabel(input.canal)],
      ['Inicio de campaña', formatEvidenceTimestamp(input.startedAt)],
      ['Cierre de campaña', formatEvidenceTimestamp(input.completedAt)],
      ['Generado', input.generatedAt],
      ['Filtro de esta muestra', input.filterLabel],
    ],
  });
  y = lastAutoY(doc, y) + 8;

  y = ensureY(doc, y, 28);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('2. Resultado general', 14, y);
  y += 4;
  autoTable(doc, {
    startY: y,
    head: [['Total', 'Enviados', 'Entregados', 'Leídos', 'Fallidos', 'Pendientes']],
    body: [[
      n(input.stats.total),
      n(input.stats.enviados),
      n(input.stats.entregados),
      n(input.stats.leidos),
      n(input.stats.errores),
      n(input.stats.pendientes),
    ]],
    styles: { fontSize: 8, cellPadding: 1.6, halign: 'center' },
    margin: PDF_TABLE_MARGIN,
    headStyles: { ...PDF_TABLE_HEAD, fontSize: 8 },
  });
  y = lastAutoY(doc, y) + 4;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(71, 85, 105);
  y = writeWrapped(
    doc,
    'Los totales salen del registro de la campaña. Entregados son confirmaciones de WhatsApp (Meta) cuando el canal lo incluye; si no consta, el campo queda vacío. El detalle de cada destinatario está en el CSV de resultados y en la constancia individual.',
    14,
    y,
    182,
    3.4
  );
  y += 8;

  y = ensureY(doc, y, 40);
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('3. Evidencia técnica de campaña', 14, y);
  y += 4;
  const varsLine = input.templateVariables
    ? input.templateVariables
    : '—';
  autoTable(doc, {
    startY: y,
    theme: 'plain',
    margin: PDF_TABLE_MARGIN,
    styles: { fontSize: 8, cellPadding: 1.4, textColor: PDF_BRAND.textMain },
    columnStyles: { 0: { cellWidth: 52, fontStyle: 'bold' }, 1: { cellWidth: 130 } },
    body: [
      ['Template Meta', dash(input.templateName)],
      ['Idioma', dash(input.templateLang)],
      ['Variables {{N}}', varsLine],
      ['Template ID Meta', dash(input.templateId)],
      ['Template Hash', dash(input.templateHash)],
    ],
  });
  y = lastAutoY(doc, y) + 6;

  y = ensureY(doc, y, 36);
  drawSoftPanelMm(doc, 14, y, 182, 34);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...PDF_BRAND.textMain);
  doc.text('Campaign ID', 16, y + 5);
  doc.setFont('courier', 'normal');
  doc.setFontSize(7);
  doc.text(input.campaignId, 16, y + 10);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('Merkle root (tanda de envío)', 16, y + 16);
  doc.setFont('courier', 'normal');
  doc.setFontSize(6.5);
  doc.text(doc.splitTextToSize(primaryRoot || '—', 178), 16, y + 21);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('TX Polygon — envío', 16, y + 27);
  doc.setFont('courier', 'normal');
  doc.setFontSize(6.5);
  doc.text(doc.splitTextToSize(primaryTx || '—', 178), 16, y + 31.5);
  y += 38;

  if (input.sendBatches.length > 1) {
    y = ensureY(doc, y, 24);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.text('Tandas de envío ancladas', 14, y);
    y += 3;
    autoTable(doc, {
      startY: y,
      head: [['Tanda', 'Destinatarios en el lote', 'Merkle root', 'TX Polygon']],
      body: input.sendBatches.map((b) => [
        b.batchId,
        b.leafCount != null ? String(b.leafCount) : '—',
        b.merkleRoot || '—',
        b.txHash || '—',
      ]),
      styles: { fontSize: 6, cellPadding: 1.2, overflow: 'ellipsize', font: 'courier' },
      margin: PDF_TABLE_MARGIN,
      headStyles: { ...PDF_TABLE_HEAD, fontSize: 7, font: 'helvetica' },
      columnStyles: { 0: { cellWidth: 28, font: 'helvetica' }, 1: { cellWidth: 28, font: 'helvetica' } },
    });
    y = lastAutoY(doc, y) + 6;
  }

  y = ensureY(doc, y, 16);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text('Huella SHA-256 del CSV de resultados', 14, y);
  y += 4;
  doc.setFont('courier', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(51, 65, 85);
  y = writeWrapped(doc, input.csvExportHash || 'Aún no se exportó el CSV de esta campaña.', 14, y, 182, 3.4);
  if (input.csvExportFileName) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    y = writeWrapped(doc, `Archivo: ${input.csvExportFileName}`, 14, y, 182, 3.4);
  }
  y += 6;

  if (primaryTx) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...PDF_BRAND.primary);
    y = writeWrapped(doc, `https://polygonscan.com/tx/${primaryTx}`, 14, y, 182, 3.4);
    y += 4;
    doc.setTextColor(15, 23, 42);
  }

  y = ensureY(doc, y, 22);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('4. Detalle de destinatarios', 14, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  const sampleNote = truncated
    ? `La campaña comprende ${n(input.rowsTotal)} registros individuales. Este PDF muestra una muestra de ${n(input.rowsShown)} (máximo ${n(input.maxRows)}). El detalle completo está en el CSV de resultados; cada comunicación tiene una constancia individual verificable con el Notification ID.`
    : `Este PDF lista los ${n(input.rowsShown)} destinatarios de la muestra. El CSV de resultados y cada constancia individual completan el expediente.`;
  y = writeWrapped(doc, sampleNote, 14, y, 182, 3.5);
  y += 4;

  const showDebt = input.rows.some((r) => r.fechaVencimiento || r.monto || r.cuotas);
  const showError = input.rows.some((r) => r.errorDetail || r.estado === 'error');
  const head = [
    '#',
    'Notification ID',
    'Nombre',
    'DNI',
    'Teléfono',
    ...(showDebt ? ['Vencimiento', 'Monto', 'Cuotas'] : []),
    'Enviado',
    'Entregado',
    'Leído',
    'Estado',
    ...(showError ? ['Error'] : []),
  ];
  const body = input.rows.map((r, i) => [
    String(i + 1),
    r.notificationId,
    r.nombre || '—',
    dash(r.dni),
    dash(r.telefono),
    ...(showDebt ? [dash(r.fechaVencimiento), dash(r.monto), dash(r.cuotas)] : []),
    formatEvidenceTimestamp(r.enviadoAt),
    formatEvidenceTimestamp(r.entregadoAt),
    formatEvidenceTimestamp(r.leidoAt),
    r.estado || '—',
    ...(showError ? [r.errorCode ? `${r.errorCode} ${r.errorDetail}`.trim() : dash(r.errorDetail)] : []),
  ]);

  autoTable(doc, {
    startY: y,
    head: [head],
    body,
    styles: { fontSize: 6, cellPadding: 1.1, overflow: 'ellipsize' },
    margin: PDF_TABLE_MARGIN,
    headStyles: { ...PDF_TABLE_HEAD, fontSize: 6.5 },
  });
  y = lastAutoY(doc, y) + 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(71, 85, 105);
  y = writeWrapped(
    doc,
    `Constancia individual: ${input.verifyAppBase}/verify?id={mailId}  ·  Notification ID en la tabla. Las TX de entrega y lectura de cada destinatario están en el CSV y en el acta individual; este reporte no las abrevia en la grilla para no volverla ilegible.`,
    14,
    y,
    182,
    3.4
  );
  y += 6;
  y = writeWrapped(
    doc,
    'Las evidencias de esta campaña se encuentran asociadas a registros individuales verificables mediante Notificas y a las transacciones blockchain indicadas en el presente reporte.',
    14,
    y,
    182,
    3.4
  );
  y += 4;
  doc.setFontSize(6);
  y = ensureY(doc, y, 6);
  doc.text(`verify-ref: ${input.verifyRef}`, 14, y);

  stampPdfChromeMm(doc, {
    pagesWithFirstHeader: [1],
    continueTitle: () => docTitle,
    footerLine1: (page, pageCount) =>
      `Notificas.com · Constancia técnica de notificación digital · ${PDF_SCHEMA.campaignReport} · pág. ${page} de ${pageCount}`,
    footerLine2: () => input.campaignId,
  });

  return doc.output('arraybuffer') as ArrayBuffer;
}
