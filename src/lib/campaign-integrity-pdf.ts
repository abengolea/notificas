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
  drawWarnPanelMm,
  stampPdfChromeMm,
} from '@/lib/pdf-brand';

export type ActaLeafRow = {
  leafIndex?: number;
  messageId: string;
  leafHash: string;
  contentHash?: string;
  eventType?: string;
  occurredAt?: string;
  nombre: string;
  email: string;
  telefono: string;
  dni: string;
};

export type ActaTandaInput = {
  orgNombre: string;
  orgCuit?: string;
  campaignId: string;
  campaignNombre: string;
  campaignAsunto?: string;
  batchId: string;
  kind: 'send' | 'event';
  status: string;
  leafCount: number;
  merkleRoot?: string;
  txHash?: string;
  payload?: string;
  sealedAt?: string;
  generatedAt: string;
  leaves: ActaLeafRow[];
  verifyRef?: string;
};

const EVENT_LABEL: Record<string, string> = {
  email_read: 'Mail abierto (reader)',
  wa_delivered: 'WhatsApp entregado',
  wa_read: 'WhatsApp leído',
};

function formatTs(v?: string): string {
  if (!v) return '—';
  const formatted = formatEvidenceTimestamp(v);
  return formatted === '—' ? v : formatted;
}

function isSyntheticEmail(email: string) {
  return email.endsWith('@notificas.internal') || email.endsWith('@wa.internal');
}

export async function buildActaTandaPdf(input: ActaTandaInput): Promise<ArrayBuffer> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const kindLabel = input.kind === 'send' ? 'ENVÍO' : 'HECHOS (recepción / lectura)';
  const explorerUrl = input.txHash ? `https://polygonscan.com/tx/${input.txHash}` : '';
  const anchored = input.status === 'anchored' && Boolean(input.merkleRoot && input.txHash);
  const docTitle = 'Acta de integridad de tanda';

  doc.setProperties({
    title: `${docTitle} — ${input.batchId}`,
    subject: 'Constancia técnica de tanda de campaña anclada en Polygon',
    creator: 'Notificas.com',
    author: 'Notificas.com',
  });

  let y = drawPdfLetterheadMm(doc, {
    mode: 'first',
    documentTitle: docTitle,
    lines: [
      input.kind === 'send' ? 'Tanda de envío' : 'Tanda de hechos (recepción / lectura)',
      'La inmutabilidad la aporta la transacción citada, no este PDF.',
    ],
  });

  const blockStart = y;
  if (explorerUrl) {
    try {
      const qr = await QRCode.toDataURL(explorerUrl, { margin: 0, width: 160 });
      doc.addImage(qr, 'PNG', 176, y, 18, 18);
      doc.setFontSize(6);
      doc.setTextColor(...PDF_BRAND.textMuted);
      doc.text('Ver TX', 181, y + 20);
      doc.setTextColor(...PDF_BRAND.textMain);
    } catch {
      /* QR opcional */
    }
  }

  const metaWidth = explorerUrl ? 155 : PDF_MM.contentWidth;
  doc.setFontSize(10);
  doc.setTextColor(...PDF_BRAND.textMain);
  doc.text(`Organización: ${input.orgNombre}${input.orgCuit ? `  ·  CUIT ${input.orgCuit}` : ''}`, 14, y);
  y += 6;
  doc.text(`Campaña: ${input.campaignNombre}`, 14, y);
  y += 5;
  doc.setFontSize(8);
  doc.setTextColor(...PDF_BRAND.textMuted);
  doc.text(`ID campaña: ${input.campaignId}`, 14, y);
  if (input.campaignAsunto) {
    y += 5;
    const asunto = doc.splitTextToSize(`Asunto: ${input.campaignAsunto}`, metaWidth);
    doc.text(asunto, 14, y);
    y += asunto.length * 4;
  }
  y += 6;
  doc.setTextColor(...PDF_BRAND.textMain);
  doc.setFontSize(10);
  doc.text(`Tanda: ${input.batchId}   ·   Tipo: ${kindLabel}`, 14, y);
  y += 5;
  doc.text(
    `Estado: ${anchored ? 'Anclada en Polygon' : input.status}   ·   Hojas: ${input.leafCount}   ·   Cierre: ${input.sealedAt || '—'}`,
    14,
    y
  );
  y += 5;
  doc.setFontSize(8);
  doc.setTextColor(...PDF_BRAND.textMuted);
  doc.text(`Acta generada: ${input.generatedAt}`, 14, y);
  y += 8;
  if (explorerUrl) y = Math.max(y, blockStart + 24);

  if (!anchored) {
    drawWarnPanelMm(doc, 14, y - 4, 182, 10);
    doc.setTextColor(...PDF_BRAND.warnText);
    doc.setFontSize(8);
    doc.text(
      'Esta tanda todavía no está anclada en blockchain. El listado es informativo; no constituye prueba on-chain.',
      16,
      y + 2
    );
    y += 12;
    doc.setTextColor(...PDF_BRAND.textMain);
  }

  const hashBoxH = input.kind === 'send' ? 42 : 38;
  drawSoftPanelMm(doc, 14, y, 182, hashBoxH);
  doc.setFontSize(8);
  doc.setTextColor(...PDF_BRAND.textMain);
  doc.text('Raíz Merkle (SHA-256)', 16, y + 5);
  doc.setFont('courier', 'normal');
  doc.setFontSize(7);
  const rootLines = doc.splitTextToSize(input.merkleRoot || '—', 178);
  doc.text(rootLines, 16, y + 10);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('Transacción Polygon (Chain ID 137)', 16, y + 18);
  doc.setFont('courier', 'normal');
  doc.setFontSize(7);
  const txLines = doc.splitTextToSize(input.txHash || '—', 178);
  doc.text(txLines, 16, y + 23);
  if (explorerUrl) {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...PDF_BRAND.primary);
    doc.setFontSize(7);
    doc.text(explorerUrl, 16, y + 30);
  }
  y += hashBoxH + 4;

  if (input.payload) {
    doc.setTextColor(71, 85, 105);
    doc.setFontSize(7);
    doc.text('Payload UTF-8 registrado en la transacción:', 14, y);
    y += 4;
    doc.setFont('courier', 'normal');
    const payloadLines = doc.splitTextToSize(input.payload, 182);
    doc.text(payloadLines, 14, y);
    y += payloadLines.length * 3.4 + 4;
    doc.setFont('helvetica', 'normal');
  }

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(9);
  doc.text('Cómo verifica un perito (sin depender de la base de datos)', 14, y);
  y += 5;
  doc.setFontSize(7);
  doc.setTextColor(51, 65, 85);
  const steps =
    input.kind === 'send'
      ? [
          '1. Abrir la transacción en polygonscan.com y decodificar el campo Input Data (UTF-8).',
          '2. El payload es CAMPAIGN_SEND|v1|{campaignId}|{batchId}|{merkleRoot}|{leafCount}|{timestamp}|{templateSealHash?}. Una TX por tanda de hasta 500, no por destinatario.',
          '3. El templateSealHash es la huella del formulario WA de toda la campaña (nombre, idioma, variables). Es el mismo para los 150 mil.',
          '4. Recalcular SHA-256(UTF-8(trim(texto_plano_personalizado))) de un destinatario: debe coincidir con su contentHash.',
          '5. La hoja es SHA-256(v1|send|campaignId|messageId|email|telefono|contentHash|adjuntos|smtp|wamid|waBodyHash|templateSealHash). Las variables efectivamente enviadas (waVars), el teléfono y el WAMID identifican el renglón.',
          '6. Con la prueba Merkle (hermano a hermano: SHA-256(left|right)) se llega a la raíz. Si coincide con la TX, ese renglón no se modificó.',
        ]
      : [
          '1. Abrir la transacción en polygonscan.com y decodificar Input Data (UTF-8).',
          '2. El payload es CAMPAIGN_EVENT|v1|{campaignId}|{batchId}|{merkleRoot}|{leafCount}|{timestamp}.',
          '3. Cada hecho (mail abierto, WA entregado, WA leído) es una hoja atada al leafHash del envío.',
          '4. Verificar la prueba Merkle hasta la raíz de esta tanda. El sobre de envío no se reabre: este acta es el de los hechos posteriores.',
        ];
  for (const line of steps) {
    const wrapped = doc.splitTextToSize(line, 182);
    doc.text(wrapped, 14, y);
    y += wrapped.length * 3.5 + 1;
  }

  const tableHead =
    input.kind === 'send'
      ? ['#', 'Destinatario', 'Email / Teléfono', 'DNI', 'Hash contenido', 'Hoja Merkle']
      : ['#', 'Destinatario', 'Email / Teléfono', 'Hecho', 'Fecha', 'Hoja Merkle'];

  const tableBody = input.leaves.map((leaf, i) => {
    const idx = leaf.leafIndex ?? i;
    const email = leaf.email && !isSyntheticEmail(leaf.email) ? leaf.email : '';
    const contact = [email, leaf.telefono].filter(Boolean).join(' / ') || '—';
    if (input.kind === 'send') {
      return [
        String(idx),
        leaf.nombre || '—',
        contact,
        leaf.dni || '—',
        leaf.contentHash || '—',
        leaf.leafHash,
      ];
    }
    return [
      String(idx),
      leaf.nombre || '—',
      contact,
      EVENT_LABEL[leaf.eventType || ''] || leaf.eventType || '—',
      formatTs(leaf.occurredAt),
      leaf.leafHash,
    ];
  });

  autoTable(doc, {
    startY: Math.min(y + 4, 250),
    head: [tableHead],
    body: tableBody,
    margin: PDF_TABLE_MARGIN,
    styles: { fontSize: 6, font: 'courier', cellPadding: 1.2, overflow: 'ellipsize' },
    headStyles: { ...PDF_TABLE_HEAD, font: 'helvetica', fontSize: 7 },
    columnStyles:
      input.kind === 'send'
        ? { 0: { cellWidth: 10 }, 4: { cellWidth: 42 }, 5: { cellWidth: 42 } }
        : { 0: { cellWidth: 10 }, 5: { cellWidth: 48 } },
  });

  const finalY =
    (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y;
  let footY = finalY + 8;
  if (footY > PDF_MM.contentBottom) {
    doc.addPage();
    footY = PDF_MM.continueTop;
  }
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...PDF_BRAND.textMuted);
  const disclaimer = doc.splitTextToSize(
      'Este documento es una constancia técnica: deja asentado el contenido (o el hecho) incluido en la tanda y el ancla pública en Polygon Mainnet. ' +
      'La inmutabilidad la aporta la transacción citada, no este PDF. ' +
      'Si se altera una sola foja, la raíz Merkle deja de coincidir con la registrada on-chain. ' +
      'Los envíos individuales (fuera de campaña) se certifican con otra transacción por mensaje.',
    182
  );
  doc.text(disclaimer, 14, footY);

  stampPdfChromeMm(doc, {
    pagesWithFirstHeader: [1],
    continueTitle: () => docTitle,
    footerLine1: (page, pageCount) =>
      `Notificas.com · ${PDF_SCHEMA.actaTanda} · tanda ${input.batchId} · pág. ${page} de ${pageCount}`,
    footerLine2: () =>
      [input.verifyRef && `verify-ref: ${input.verifyRef}`, input.txHash?.slice(0, 18) && `${input.txHash.slice(0, 18)}…`]
        .filter(Boolean)
        .join('  ·  ') || undefined,
  });

  return doc.output('arraybuffer') as ArrayBuffer;
}

export type ActaDestinatarioInput = {
  orgNombre: string;
  orgCuit?: string;
  campaignId: string;
  campaignNombre: string;
  campaignAsunto?: string;
  generatedAt: string;
  messageId: string;
  canal?: string;
  recipientNombre: string;
  recipientEmail: string;
  recipientTelefono?: string;
  recipientDni?: string;
  recipientLegajo?: string;
  /** Texto intimado a esta persona (asunto y cuerpo ya personalizados). */
  asuntoPersonalizado?: string;
  cuerpoPersonalizado?: string;
  whatsappSent?: {
    templateName: string;
    templateLang: string;
    templateHash?: string | null;
    templateId?: string | null;
    renderedBody: string | null;
    renderedHeader?: string | null;
    renderedFooter?: string | null;
    templateBodyMissing?: boolean;
    variables: Array<{ n: number; field?: string; value: string }>;
    buttons: Array<{ text: string | null; url: string | null; urlParameter: string | null }>;
  } | null;
  attachments?: Array<{ nombre: string; hash?: string }>;
  /** True si identidad y texto salen de evidence_snapshots (WORM). */
  evidenceSealed?: boolean;
  smtpMessageId?: string;
  wamid?: string;
  phoneNumberId?: string;
  wabaId?: string;
  chronology: {
    emailEnviadoAt?: string;
    emailLeidoAt?: string;
    waEnviadoAt?: string;
    waEntregadoAt?: string;
    waLeidoAt?: string;
  };
  intact: boolean;
  summary: string;
  contentHash: string;
  storedHash: string | null;
  contentMatch: boolean | null;
  send: {
    batchId: string | null;
    txHash: string | null;
    merkleRoot: string | null;
    leafHash: string | null;
    merkleValid: boolean | null;
    onChainMatch: boolean | null;
  };
  events: Array<{
    type: string;
    present: boolean;
    occurredAt?: string;
    merkleValid?: boolean | null;
    txHash?: string;
  }>;
  verifyRef?: string;
};

function checkLabel(ok: boolean | null | undefined): string {
  if (ok === true) return 'Sí';
  if (ok === false) return 'No';
  return 'Pendiente';
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function canalLabel(canal?: string): string {
  if (canal === 'whatsapp') return 'WhatsApp';
  if (canal === 'ambos') return 'Correo electrónico y WhatsApp';
  return 'Correo electrónico';
}

function isMixedCanal(canal?: string): boolean {
  return canal === 'ambos';
}

function showsEmailContent(canal?: string): boolean {
  return canal !== 'whatsapp';
}

function showsWhatsAppContent(canal?: string): boolean {
  return canal === 'whatsapp' || canal === 'ambos';
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

function hechoFecha(iso?: string): [string, string] {
  if (!iso) return ['No consta a la fecha de esta constancia', 'Pendiente de registro'];
  return [formatTs(iso), 'Registrado por el sistema'];
}

export async function buildActaDestinatarioPdf(input: ActaDestinatarioInput): Promise<ArrayBuffer> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const explorerUrl = input.send.txHash ? `https://polygonscan.com/tx/${input.send.txHash}` : '';
  const email = input.recipientEmail && !isSyntheticEmail(input.recipientEmail) ? input.recipientEmail : '';
  const cuerpo = stripHtml(input.cuerpoPersonalizado || '');
  const asunto = (input.asuntoPersonalizado || input.campaignAsunto || '').trim();
  const destinatario = input.recipientNombre || email || (input.evidenceSealed === false ? 'Destinatario no transcrito' : 'el destinatario');
  const remitente = input.orgNombre || 'la organización remitente';

  const docTitle = 'Constancia individual de comunicación digital';

  doc.setProperties({
    title: `${docTitle} — ${input.messageId}`,
    subject: 'Constancia técnica de un destinatario de campaña',
    creator: 'Notificas.com',
    author: 'Notificas.com',
  });

  let y = drawPdfLetterheadMm(doc, {
    mode: 'first',
    documentTitle: docTitle,
    lines: [
      'Parte I — Relato de la comunicación',
      'Destinado a jueces, abogados y funcionarios. El anexo técnico para perito consta al final.',
    ],
  });
  doc.setTextColor(...PDF_BRAND.textMain);

  if (explorerUrl) {
    try {
      const qr = await QRCode.toDataURL(explorerUrl, { margin: 0, width: 160 });
      doc.addImage(qr, 'PNG', 176, y, 18, 18);
      doc.setFontSize(6);
      doc.setTextColor(...PDF_BRAND.textMuted);
      doc.text('Ver TX', 181, y + 20);
      doc.setTextColor(...PDF_BRAND.textMain);
    } catch {
      /* QR opcional */
    }
  }

  const idWidth = explorerUrl ? 155 : PDF_MM.contentWidth;
  const idStart = y;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(destinatario, 14, y);
  doc.setFont('helvetica', 'normal');
  y += 5;
  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);
  const idLine = [
    input.recipientDni ? `DNI ${input.recipientDni}` : '',
    input.recipientLegajo ? `Legajo ${input.recipientLegajo}` : '',
    email,
    input.recipientTelefono,
  ]
    .filter(Boolean)
    .join('  ·  ');
  const idWrapped = doc.splitTextToSize(idLine || '—', idWidth);
  doc.text(idWrapped, 14, y);
  y += idWrapped.length * 4 + 1;
  const campLine = doc.splitTextToSize(
    `Campaña: ${input.campaignNombre}  ·  ${canalLabel(input.canal)}`,
    idWidth
  );
  doc.text(campLine, 14, y);
  y += campLine.length * 4 + 4;
  if (explorerUrl) y = Math.max(y, idStart + 24);

  if (input.evidenceSealed === false) {
    y = ensureY(doc, y, 16);
    drawWarnPanelMm(doc, 14, y - 4, 182, 14);
    doc.setTextColor(...PDF_BRAND.warnText);
    doc.setFontSize(8);
    y = writeWrapped(
      doc,
      'No hay copia inalterable del envío. Esta constancia no transcribe identidad ni texto desde registros que se pueden modificar. El anexo técnico, si existe, muestra huellas y Merkle.',
      16,
      y,
      178,
      3.6
    );
    y += 8;
    doc.setTextColor(15, 23, 42);
  }

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Objeto de esta constancia', 14, y);
  doc.setFont('helvetica', 'normal');
  y += 6;
  doc.setFontSize(9);
  const declaracion = input.evidenceSealed
    ? `Notificas.com deja constancia de una comunicación digital enviada por ${remitente}${input.orgCuit ? ` (CUIT ${input.orgCuit})` : ''} a ${destinatario}, en la campaña «${input.campaignNombre}». ` +
      `En el instante del envío el sistema guarda una copia inalterable de quién envió, a quién se dirigió y qué se envió. Esa copia no se vuelve a armar después con datos actuales de la campaña: lo transcrito en las páginas siguientes es exactamente lo que quedó registrado entonces. ` +
      `Los hechos posteriores (aceptación del correo por el proveedor, o entrega y lectura que informe WhatsApp) se anotan aparte, según lo que esos terceros comunicaron después. No sustituyen ni modifican el texto original. El modo técnico de conservar y verificar esa copia consta en el anexo para perito.`
    : `No se transcribe el contenido ni la identidad desde registros que se pueden modificar. Consulte el anexo técnico y, si existe, la constancia de envío inalterable.`;
  y = writeWrapped(doc, declaracion, 14, y, 182, 4.2);
  y += 6;

  y = ensureY(doc, y, 20);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('Identificación de las partes y del envío', 14, y);
  y += 4;
  autoTable(doc, {
    startY: y,
    theme: 'plain',
    margin: PDF_TABLE_MARGIN,
    styles: { fontSize: 8, cellPadding: 1.5, textColor: PDF_BRAND.textMain },
    columnStyles: { 0: { cellWidth: 52, fontStyle: 'bold' }, 1: { cellWidth: 130 } },
    body: [
      ['Remitente', `${remitente}${input.orgCuit ? `  ·  CUIT ${input.orgCuit}` : ''}`],
      ['Destinatario', destinatario],
      ...(input.recipientDni ? [['DNI / identificación', input.recipientDni]] : []),
      ...(input.recipientLegajo ? [['Legajo', input.recipientLegajo]] : []),
      ...(email ? [['Correo del destinatario', email]] : []),
      ...(input.recipientTelefono ? [['Teléfono', input.recipientTelefono]] : []),
      ['Campaña', input.campaignNombre],
      ...(input.canal === 'whatsapp'
        ? []
        : asunto
          ? [['Asunto (correo)', asunto]]
          : []),
      ['Canal', canalLabel(input.canal)],
      ['Identificador de mensaje', input.messageId],
      ...(input.smtpMessageId ? [['SMTP Message-ID (aceptación)', input.smtpMessageId]] : []),
      ...(input.wamid ? [['WAMID (Meta)', input.wamid]] : []),
      ...(input.phoneNumberId ? [['Phone Number ID (Meta)', input.phoneNumberId]] : []),
      ...(input.wabaId ? [['WABA ID (Meta)', input.wabaId]] : []),
      ['Origen del texto y de las partes', input.evidenceSealed ? 'Copia inalterable tomada al enviar' : 'Sin copia inalterable del envío'],
      ['Fecha de emisión', input.generatedAt],
    ],
  });
  y = lastAutoY(doc, y) + 8;

  const waSent = input.whatsappSent || null;
  const showEmailContent = showsEmailContent(input.canal);
  const showWaContent = showsWhatsAppContent(input.canal) || Boolean(waSent);

  const renderEmailBlock = () => {
    y = ensureY(doc, y, 16);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text(
      showWaContent ? 'Contenido enviado por correo (lector)' : 'Contenido del mensaje remitido',
      14,
      y
    );
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    y = writeWrapped(
      doc,
      input.evidenceSealed
        ? 'Texto del correo y del lector, con variables ya sustituidas. Huella SHA-256 en el anexo técnico.'
        : 'El texto no se transcribe: no hay snapshot sellado.',
      14,
      y,
      182,
      3.6
    );
    y += 3;
    if (asunto) {
      y = ensureY(doc, y, 8);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);
      y = writeWrapped(doc, `Asunto: ${asunto}`, 14, y, 182, 3.8);
      y += 2;
    }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    if (cuerpo) {
      y = writeWrapped(doc, cuerpo, 14, y, 182, 4.2);
    } else {
      y = writeWrapped(doc, 'Sin texto de correo en snapshot sellado.', 14, y, 182, 4.2);
    }
    y += 8;
  };

  const renderWhatsAppBlock = () => {
    y = ensureY(doc, y, 16);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    if (!waSent) {
      doc.text('Contenido enviado por WhatsApp', 14, y);
      y += 5;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      y = writeWrapped(
        doc,
        'No hay pedido a Meta en el snapshot. No se reconstruye el globo desde datos vivos.',
        14,
        y,
        182,
        3.6
      );
      y += 8;
      return;
    }
    doc.text(waSent.renderedBody ? 'Contenido exacto enviado' : 'Contenido enviado por WhatsApp', 14, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    if (!waSent.renderedBody) {
      y = writeWrapped(
        doc,
        waSent.templateBodyMissing
          ? 'No se pudo lacrar el texto fijo de Meta en este envío. Se certifican el nombre del template, el idioma y las variables (piezas del mensaje). El WhatsApp sí se envió.'
          : 'No se almacena el texto fijo del template de Meta. Se transcriben las variables enviadas (ya sustituidas).',
        14,
        y,
        182,
        3.6
      );
      y += 3;
    }
    if (waSent.renderedHeader) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);
      y = writeWrapped(doc, `Encabezado: ${waSent.renderedHeader}`, 14, y, 182, 3.6);
      y += 2;
    }
    if (waSent.renderedBody) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(15, 23, 42);
      y = writeWrapped(doc, waSent.renderedBody, 14, y, 182, 4.2);
      y += 4;
    }
    if (waSent.renderedFooter) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      y = writeWrapped(doc, waSent.renderedFooter, 14, y, 182, 3.6);
      y += 3;
    }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    y = writeWrapped(
      doc,
      `Template: ${waSent.templateName} · ${waSent.templateLang}` +
        (waSent.templateHash ? ` · Template Hash: ${waSent.templateHash}` : '') +
        (waSent.templateId ? ` · ID ${waSent.templateId}` : ''),
      14,
      y,
      182,
      3.4
    );
    y += 3;
    if (waSent.variables.length > 0) {
      y = ensureY(doc, y, 16);
      autoTable(doc, {
        startY: y,
        head: [['{{n}}', 'Campo', 'Valor enviado a Meta']],
        body: waSent.variables.map((v) => [
          `{{${v.n}}}`,
          v.field || '—',
          v.value || '—',
        ]),
        styles: { fontSize: 8, cellPadding: 1.4, overflow: 'ellipsize' },
        margin: PDF_TABLE_MARGIN,
        headStyles: { ...PDF_TABLE_HEAD, fontSize: 8 },
        columnStyles: { 0: { cellWidth: 22 }, 1: { cellWidth: 36 } },
      });
      y = lastAutoY(doc, y) + 4;
    }
    if (waSent.buttons.length > 0) {
      for (const btn of waSent.buttons) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(15, 23, 42);
        const label = btn.text ? `Botón: ${btn.text}` : 'Botón URL';
        const dest = btn.url
          ? `Destino: ${btn.url}`
          : btn.urlParameter
            ? `Parámetro enviado a Meta: ${btn.urlParameter}`
            : null;
        y = writeWrapped(doc, dest ? `${label}. ${dest}` : label, 14, y, 182, 3.6);
        y += 2;
      }
    }
    y += 6;
  };

  if (isMixedCanal(input.canal)) {
    renderEmailBlock();
    renderWhatsAppBlock();
  } else if (showWaContent && !showEmailContent) {
    renderWhatsAppBlock();
  } else if (showEmailContent) {
    renderEmailBlock();
  } else {
    y = ensureY(doc, y, 16);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text('Contenido del mensaje remitido', 14, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    y = writeWrapped(doc, 'No hay texto de WhatsApp ni de correo en el snapshot sellado.', 14, y, 182, 3.6);
    y += 8;
  }

  if (input.attachments && input.attachments.length > 0) {
    y = ensureY(doc, y, 20);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text('Documentos adjuntos remitidos', 14, y);
    y += 4;
    autoTable(doc, {
      startY: y,
      head: [['#', 'Nombre del archivo', 'Hash SHA-256']],
      body: input.attachments.map((att, i) => [String(i + 1), att.nombre || 'Adjunto', att.hash || '—']),
      styles: { fontSize: 7, cellPadding: 1.4, overflow: 'ellipsize' },
      margin: PDF_TABLE_MARGIN,
      headStyles: { ...PDF_TABLE_HEAD, fontSize: 7 },
      columnStyles: { 0: { cellWidth: 10 }, 2: { cellWidth: 72, font: 'courier', fontSize: 6 } },
    });
    y = lastAutoY(doc, y) + 8;
  }

  y = ensureY(doc, y, 24);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('Cronología de los hechos', 14, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  y = writeWrapped(
    doc,
    input.canal === 'whatsapp'
      ? 'WhatsApp: enviado / entregado al dispositivo / leído se consignan cuando Meta lo confirma. Un hecho pendiente no niega el envío.'
      : 'Correo: la aceptación SMTP no es entrega en la casilla. WhatsApp: enviado / entregado al dispositivo / leído se consignan por separado cuando Meta lo confirma. Un hecho pendiente no niega el envío.',
    14,
    y,
    182,
    3.6
  );
  y += 3;

  const showEmail =
    input.canal !== 'whatsapp' &&
    (input.canal !== 'ambos' || Boolean(input.smtpMessageId || input.chronology.emailEnviadoAt));
  const showWa = showsWhatsAppContent(input.canal);
  const chronoRows: string[][] = [];
  if (showEmail) {
    const [envFecha, envObs] = hechoFecha(input.chronology.emailEnviadoAt);
    const [leiFecha, leiObs] = hechoFecha(input.chronology.emailLeidoAt);
    chronoRows.push(['Correo aceptado por el proveedor SMTP', envFecha, envObs]);
    chronoRows.push(['Correo abierto (pixel / reader)', leiFecha, leiObs]);
  }
  if (showWa) {
    const [envFecha, envObs] = hechoFecha(input.chronology.waEnviadoAt);
    const [entFecha, entObs] = hechoFecha(input.chronology.waEntregadoAt);
    const [leiFecha, leiObs] = hechoFecha(input.chronology.waLeidoAt);
    chronoRows.push(['WhatsApp enviado (aceptado por Meta)', envFecha, envObs]);
    chronoRows.push(['WhatsApp entregado al dispositivo (Meta)', entFecha, entObs]);
    chronoRows.push(['WhatsApp leído (Meta)', leiFecha, leiObs]);
  }
  autoTable(doc, {
    startY: y,
    head: [['Hecho', 'Fecha y hora', 'Estado']],
    body: chronoRows,
    styles: { fontSize: 8, cellPadding: 1.6 },
    margin: PDF_TABLE_MARGIN,
    headStyles: { ...PDF_TABLE_HEAD, fontSize: 8 },
    columnStyles: { 0: { cellWidth: 62 }, 1: { cellWidth: 52 }, 2: { cellWidth: 68 } },
  });
  y = lastAutoY(doc, y) + 10;

  y = ensureY(doc, y, 36);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('Alcance de este documento', 14, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  const statements = [
    'Esta Parte I relata quién envió, a quién se dirigió, qué se envió y qué hechos posteriores registraron los proveedores. La valoración de esos hechos corresponde a quien resuelve el expediente.',
    'La integridad del texto se puede comprobar con la huella SHA-256 y, si la tanda está anclada, con la transacción de Polygon citada en el anexo. Alterar el texto hace que la huella deje de coincidir.',
    'Que el servidor de correo haya aceptado el mensaje no significa que haya llegado a la casilla. Entrega y lectura de WhatsApp se informan solo si Meta las confirmó.',
    `Emisión: ${input.generatedAt}.`,
  ];
  for (const statement of statements) {
    y = ensureY(doc, y, 10);
    doc.text('•', 14, y);
    y = writeWrapped(doc, statement, 20, y, 176, 3.8);
    y += 2;
  }

  const anexoTitle = 'Anexo técnico — para perito informático';
  doc.addPage();
  const techStartPage = doc.getNumberOfPages();
  y = drawPdfLetterheadMm(doc, {
    mode: 'first',
    documentTitle: anexoTitle,
    lines: ['Parte II — Comprobaciones criptográficas, Merkle y transacción en Polygon'],
  });
  doc.setTextColor(...PDF_BRAND.textMain);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('Snapshot (evidence_snapshot) y recálculo', 14, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);
  y = writeWrapped(
    doc,
    'El evidence_snapshot es un registro de escritura única (WORM): se sella al enviar y no se modifica. Conserva identidad de las partes, texto o pedido a Meta, hashes de adjuntos, WAMID y Message-ID SMTP si existen. ' +
      'Esta acta no reconstruye el mensaje desde la campaña viva (plantilla, asunto o variables actuales): transcribe el snapshot. ' +
      'El recálculo del perito es una operación distinta: SHA-256(UTF-8(trim(texto_plano))) del texto de la Parte I debe coincidir con contentHash del snapshot y, si hay tanda, con la hoja Merkle anclada en Polygon. ' +
      'El recálculo no sustituye al snapshot: lo confronta. Si el PDF o el texto se alteran, el hash deja de coincidir.',
    14,
    y,
    182,
    3.6
  );
  y += 8;
  doc.setTextColor(15, 23, 42);

  if (!input.send.txHash) {
    drawWarnPanelMm(doc, 14, y - 4, 182, 10);
    doc.setTextColor(...PDF_BRAND.warnText);
    doc.setFontSize(8);
    doc.text(
      'Esta persona todavía no está en una tanda cerrada. El anexo es informativo; no constituye prueba on-chain.',
      16,
      y + 2
    );
    y += 12;
    doc.setTextColor(15, 23, 42);
  } else {
    doc.setFontSize(8);
    doc.setTextColor(
      ...(input.intact ? PDF_BRAND.ok : PDF_BRAND.warnText)
    );
    doc.text(
      input.intact
        ? 'Estado: íntegro — el texto y la foja coinciden con el lacre en Polygon.'
        : `Estado: ${input.summary}`,
      14,
      y
    );
    y += 8;
    doc.setTextColor(15, 23, 42);
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Comprobaciones', 14, y);
  y += 4;
  autoTable(doc, {
    startY: y,
    theme: 'plain',
    margin: PDF_TABLE_MARGIN,
    styles: { fontSize: 8, cellPadding: 1.4, textColor: PDF_BRAND.textMain },
    columnStyles: { 0: { cellWidth: 130 }, 1: { cellWidth: 50, fontStyle: 'bold' } },
    body: [
      ['El texto del snapshot coincide con la huella guardada', checkLabel(input.contentMatch)],
      ['La foja entra en el árbol de su tanda', checkLabel(input.send.merkleValid)],
      ['La raíz coincide con la transacción en Polygon', checkLabel(input.send.onChainMatch)],
    ],
  });
  y = lastAutoY(doc, y) + 8;

  y = ensureY(doc, y, 48);
  drawSoftPanelMm(doc, 14, y, 182, 42);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...PDF_BRAND.textMain);
  doc.text('Huella de contenido (SHA-256)', 16, y + 5);
  doc.setFont('courier', 'normal');
  doc.setFontSize(7);
  doc.text(doc.splitTextToSize(input.contentHash || '—', 178), 16, y + 10);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('Raíz Merkle / transacción Polygon', 16, y + 18);
  doc.setFont('courier', 'normal');
  doc.setFontSize(7);
  doc.text(doc.splitTextToSize(input.send.merkleRoot || '—', 178), 16, y + 23);
  doc.text(doc.splitTextToSize(input.send.txHash || '—', 178), 16, y + 28);
  if (explorerUrl) {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...PDF_BRAND.primary);
    doc.setFontSize(7);
    doc.text(explorerUrl, 16, y + 35);
  }
  y += 48;
  doc.setFont('helvetica', 'normal');

  const eventRows = input.events
    .filter((ev) => input.canal !== 'whatsapp' || ev.type !== 'email_read')
    .map((ev) => [
    EVENT_LABEL[ev.type] || ev.type,
    ev.present ? formatTs(ev.occurredAt) : 'Pendiente',
    ev.present ? checkLabel(ev.merkleValid ?? true) : '—',
    ev.txHash || '—',
  ]);
  if (eventRows.length > 0) {
    y = ensureY(doc, y, 20);
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Hechos posteriores anclados', 14, y);
    y += 4;
    autoTable(doc, {
      startY: y,
      head: [['Hecho', 'Fecha', 'En el árbol', 'TX']],
      body: eventRows,
      styles: { fontSize: 7, font: 'helvetica', cellPadding: 1.4, overflow: 'ellipsize' },
      margin: PDF_TABLE_MARGIN,
      headStyles: { ...PDF_TABLE_HEAD, fontSize: 7 },
      columnStyles: { 3: { cellWidth: 52, font: 'courier', fontSize: 6 } },
    });
    y = lastAutoY(doc, y) + 8;
  }

  y = ensureY(doc, y, 28);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('Cómo verifica un perito (sin depender de la base de datos)', 14, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(51, 65, 85);
  const steps = [
    '1. Abrir la transacción en polygonscan.com y decodificar Input Data (UTF-8).',
    '2. El payload de envío es CAMPAIGN_SEND|v1|{campaignId}|{batchId}|{merkleRoot}|{leafCount}|{timestamp}|{templateSealHash?}. Una TX por tanda, no por persona.',
    '3. El template es el formulario de toda la campaña. Esta foja contiene los datos individualizados del destinatario, las variables efectivamente enviadas, el teléfono y el identificador WAMID correspondiente.',
    '4. Recalcular SHA-256(UTF-8(trim(texto_plano_personalizado))) del texto transcrito en la Parte I: debe coincidir con la huella de contenido.',
    '5. Si se altera esta foja, la raíz Merkle deja de coincidir con la registrada on-chain.',
  ];
  for (const line of steps) {
    y = writeWrapped(doc, line, 14, y, 182, 3.5);
    y += 1;
  }
  y += 4;
  doc.setTextColor(71, 85, 105);
  y = writeWrapped(
    doc,
    'Este anexo es una constancia técnica oponible de un destinatario puntual. ' +
      'La inmutabilidad la aporta la transacción citada, no este PDF. ' +
      `Acta generada: ${input.generatedAt}.`,
    14,
    y,
    182,
    3.4
  );
  if (input.verifyRef) {
    y += 4;
    doc.setFontSize(6);
    y = ensureY(doc, y, 6);
    doc.text(`verify-ref: ${input.verifyRef}`, 14, y);
  }

  stampPdfChromeMm(doc, {
    pagesWithFirstHeader: [1, techStartPage],
    continueTitle: (page) =>
      page < techStartPage ? docTitle : anexoTitle,
    footerLine1: (page, pageCount) => {
      const part =
        page < techStartPage
          ? 'Parte I — Relato de la comunicación'
          : 'Parte II — Anexo técnico';
      return `Notificas.com · ${part} · ${PDF_SCHEMA.actaIndividual} · pág. ${page} de ${pageCount}`;
    },
    footerLine2: () => input.messageId,
  });

  return doc.output('arraybuffer') as ArrayBuffer;
}
