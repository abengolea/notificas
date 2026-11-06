import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import QRCode from 'qrcode';
import {
  formatEvidenceTimestamp,
  formatEvidenceTimestampArtCell,
  PDF_SCHEMA,
} from '@/lib/pdf-evidence-format';
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
import { publicAppBase, publicCertificateVerifyUrl } from '@/lib/public-verify-url';
import { SITE_CONTACT, SITE_LEGAL_NAME } from '@/lib/seo';
import { maskPhoneForLote } from '@/lib/mask-phone';
import { formatCuit } from '@/lib/cuit';
import { LEAF_SPEC_PATH } from '@/lib/polygon-published';
import { assertPrintedLoteIntegrity, asLeafHash } from '@/lib/lote-leaf-hash';
import { sha256Hex } from '@/lib/merkle';

export type ActaLeafRow = {
  leafIndex?: number;
  messageId: string;
  leafHash: string;
  kind?: string;
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
  templateName?: string;
  templateHash?: string;
  batchId: string;
  kind: 'send' | 'event';
  status: string;
  leafCount: number;
  merkleRoot?: string;
  txHash?: string;
  txFrom?: string;
  blockNumber?: number;
  blockTime?: string;
  payload?: string;
  sealedAt?: string;
  generatedAt: string;
  leaves: ActaLeafRow[];
  verifyRef?: string;
  leavesDigest?: string;
  digestMatch?: boolean | null;
};

const EVENT_LABEL: Record<string, string> = {
  email_read: 'Correo abierto',
  wa_delivered: 'WhatsApp entregado',
  wa_read: 'WhatsApp leído',
};

function formatTs(v?: string): string {
  if (!v) return '—';
  const formatted = formatEvidenceTimestamp(v);
  return formatted === '—' ? v : formatted;
}

function artDateLong(value?: string): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(d);
}

function blockTimePair(iso?: string): string {
  if (!iso) return '—';
  const utc = formatEvidenceTimestamp(iso).split(' (')[0] || iso;
  const art = formatEvidenceTimestampArtCell(iso);
  return `${utc} UTC · ${art} ART`;
}

/** Parte strings largos en el delimitador (URLs en &, payload en |) para no cortar a mitad de un token. */
function wrapAtDelimiter(doc: jsPDF, text: string, maxWidth: number, delim: string): string[] {
  const parts = text.split(delim);
  const lines: string[] = [];
  let cur = parts[0] || '';
  for (let i = 1; i < parts.length; i++) {
    const piece = delim + parts[i];
    const trial = cur + piece;
    if (doc.getTextWidth(trial) <= maxWidth) {
      cur = trial;
      continue;
    }
    if (cur) lines.push(cur);
    if (doc.getTextWidth(piece) <= maxWidth) {
      cur = piece;
      continue;
    }
    const forced = doc.splitTextToSize(piece, maxWidth) as string[];
    lines.push(...forced.slice(0, -1));
    cur = forced[forced.length - 1] || '';
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [text];
}

export function loteHechoLabel(eventType?: string, kind?: string): string {
  if (kind === 'error') return 'Error de envío';
  if (eventType && EVENT_LABEL[eventType]) return EVENT_LABEL[eventType];
  if (kind === 'send' || (!eventType && kind !== 'event')) return 'Envío';
  return eventType || 'Hecho';
}

export function loteClosingSentence(input: ActaTandaInput): string {
  const n = input.leaves.length || input.leafCount;
  const when =
    artDateLong(input.blockTime) ||
    artDateLong(input.leaves.find((l) => l.occurredAt)?.occurredAt) ||
    '';
  const types = input.leaves.map((l) => l.eventType).filter(Boolean);
  const onlyWaDelivered = types.length > 0 && types.every((t) => t === 'wa_delivered');
  const onlyWaRead = types.length > 0 && types.every((t) => t === 'wa_read');
  const onlyMailRead = types.length > 0 && types.every((t) => t === 'email_read');
  let what: string;
  if (input.kind === 'send') what = `${n} envío${n === 1 ? '' : 's'}`;
  else if (onlyWaDelivered) what = `${n} entrega${n === 1 ? '' : 's'} de WhatsApp`;
  else if (onlyWaRead) what = `${n} lectura${n === 1 ? '' : 's'} de WhatsApp`;
  else if (onlyMailRead) what = `${n} apertura${n === 1 ? '' : 's'} de correo`;
  else what = `${n} hecho${n === 1 ? '' : 's'} (sin lecturas si no constan)`;
  const camp = input.campaignNombre || 'la campaña';
  const anchored = input.status === 'anchored' && Boolean(input.merkleRoot && input.txHash);
  const verb = n === 1 ? 'se registró' : 'se registraron';
  const dateBit = when ? `El ${when} ${verb}` : verb.charAt(0).toUpperCase() + verb.slice(1);
  const chain = anchored ? 'El lote quedó anclado en Polygon' : 'El lote aún no está anclado en Polygon';
  return `${dateBit} ${what} de la campaña ${camp}. ${chain}.`;
}

export function lotePositiveStatement(input: ActaTandaInput): string {
  const delivered = input.leaves.filter((l) => l.eventType === 'wa_delivered').length;
  const waRead = input.leaves.filter((l) => l.eventType === 'wa_read').length;
  const mailRead = input.leaves.filter((l) => l.eventType === 'email_read').length;
  const parts: string[] = [];
  if (delivered) {
    parts.push(
      `Meta Platforms informó estado «delivered» para ${delivered} mensaje${delivered === 1 ? '' : 's'} de esta campaña${loteArtRange(input.leaves.filter((l) => l.eventType === 'wa_delivered'))}`
    );
  }
  if (waRead) {
    parts.push(`informó lectura de WhatsApp para ${waRead}`);
  }
  if (mailRead) {
    parts.push(`se registró apertura del lector en ${mailRead} correo${mailRead === 1 ? '' : 's'}`);
  }
  if (!parts.length) {
    return input.kind === 'send'
      ? 'Este lote registra el pedido de envío. Lo que cada destinatario recibió consta en su constancia individual.'
      : 'Este lote no incluye lecturas; solo los hechos que figuran en la tabla.';
  }
  const block =
    input.blockNumber != null && input.blockTime
      ? ` Ese conjunto fue sellado en el bloque ${input.blockNumber} de Polygon el ${blockTimePair(input.blockTime)}.`
      : input.txHash
        ? ' Ese conjunto fue anclado en la transacción citada.'
        : '';
  return `${parts.join('; ')}.${block}`;
}

function loteArtRange(leaves: ActaLeafRow[]): string {
  const times = leaves
    .map((l) => l.occurredAt)
    .filter((t): t is string => Boolean(t))
    .sort();
  if (!times.length) return '';
  const a = formatEvidenceTimestampArtCell(times[0]);
  const b = formatEvidenceTimestampArtCell(times[times.length - 1]);
  if (a === '—' || b === '—') return '';
  if (a === b) return ` el ${a} ART`;
  return ` entre ${a} y ${b} ART`;
}

function isSyntheticEmail(email: string) {
  return email.endsWith('@notificas.internal') || email.endsWith('@wa.internal');
}

export async function buildActaTandaPdf(input: ActaTandaInput): Promise<ArrayBuffer> {
  const printed = await assertPrintedLoteIntegrity(input);
  const leaves = input.leaves.map((leaf, i) => ({ ...leaf, leafHash: printed.hashes[i] }));
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const explorerUrl = input.txHash ? `https://polygonscan.com/tx/${input.txHash}` : '';
  const specUrl = `${publicAppBase()}${LEAF_SPEC_PATH}`;
  const verifyUrl = publicCertificateVerifyUrl({
    campaignId: input.campaignId,
    batchId: input.batchId,
    kind: 'campaign_acta',
    hash: input.merkleRoot,
  });
  const individualUrl = `${publicAppBase()}/verify?campaignId=${encodeURIComponent(input.campaignId)}&kind=campaign_acta_recipient&leaf=`;
  const anchored = input.status === 'anchored' && Boolean(input.merkleRoot && input.txHash);
  const docTitle = 'Constancia técnica de integridad del lote';
  const closing = loteClosingSentence(input);
  const issuerCuit = formatCuit(SITE_CONTACT.cuit) || SITE_CONTACT.cuit;
  const issuer = `${SITE_LEGAL_NAME} · CUIT ${issuerCuit}`;
  const orgCuit = formatCuit(input.orgCuit);
  const templateHash = input.templateHash
    ? (() => {
        try {
          return asLeafHash(input.templateHash, 'hash plantilla');
        } catch {
          return '';
        }
      })()
    : '';

  doc.setProperties({
    title: `${docTitle} — ${input.batchId}`,
    subject: 'Índice anclado de un lote de campaña. No sustituye la constancia individual.',
    creator: SITE_LEGAL_NAME,
    author: SITE_LEGAL_NAME,
  });

  let y = drawPdfLetterheadMm(doc, {
    mode: 'first',
    documentTitle: docTitle,
    lines: [
      closing,
      'Índice anclado. No sustituye la constancia individual. La inmutabilidad la aporta la transacción, no este PDF.',
      'La transacción prueba que estas huellas existían a la hora de su bloque; las horas de la tabla son las de cada hecho.',
    ],
  });

  const blockStart = y;
  try {
    const qr = await QRCode.toDataURL(verifyUrl, { margin: 0, width: 160 });
    doc.addImage(qr, 'PNG', 176, y, 18, 18);
    doc.setFontSize(6);
    doc.setTextColor(...PDF_BRAND.textMuted);
    doc.text('Validar en la red', 175, y + 20);
    doc.setTextColor(...PDF_BRAND.textMain);
  } catch {
    /* QR opcional */
  }

  const metaWidth = 155;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...PDF_BRAND.textMuted);
  doc.text('Emisor de esta constancia', 14, y);
  y += 4;
  doc.setFontSize(10);
  doc.setTextColor(...PDF_BRAND.textMain);
  doc.text(issuer, 14, y);
  y += 6;
  doc.setFontSize(8);
  doc.setTextColor(...PDF_BRAND.textMuted);
  doc.text('Organización (cliente)', 14, y);
  y += 4;
  doc.setFontSize(10);
  doc.setTextColor(...PDF_BRAND.textMain);
  const orgLine = `${input.orgNombre}${orgCuit ? `  ·  CUIT ${orgCuit}` : ''}`;
  doc.text(doc.splitTextToSize(orgLine, metaWidth), 14, y);
  y += 6;
  doc.text(`Campaña: ${input.campaignNombre}`, 14, y);
  y += 5;
  doc.setFontSize(8);
  doc.setTextColor(...PDF_BRAND.textMuted);
  doc.text(`ID campaña: ${input.campaignId}  ·  Lote: ${input.batchId}`, 14, y);
  y += 4;
  if (templateHash) {
    doc.setFont('courier', 'normal');
    const hashLines = doc.splitTextToSize(`Hash plantilla: ${templateHash}`, metaWidth);
    doc.text(hashLines, 14, y);
    y += hashLines.length * 3.4;
    doc.setFont('helvetica', 'normal');
  }
  doc.setTextColor(...PDF_BRAND.primary);
  const verifyLines = wrapAtDelimiter(doc, verifyUrl, metaWidth, '&');
  doc.text(verifyLines, 14, y);
  y += verifyLines.length * 3.4 + 2;
  y = Math.max(y, blockStart + 26);

  if (!anchored) {
    drawWarnPanelMm(doc, 14, y, 182, 10);
    doc.setTextColor(...PDF_BRAND.warnText);
    doc.setFontSize(8);
    doc.text(
      'Este lote todavía no está anclado en blockchain. El listado es informativo; no constituye prueba on-chain.',
      16,
      y + 6
    );
    y += 14;
    doc.setTextColor(...PDF_BRAND.textMain);
  }

  const chainLines = [
    `Transacción: ${input.txHash || '—'}`,
    input.txFrom ? `Emitida desde ${input.txFrom}` : `Dirección emisora: ver ${specUrl}`,
    input.blockNumber != null
      ? `Bloque ${input.blockNumber} · ${blockTimePair(input.blockTime)}`
      : 'Número de bloque: no consta (la fecha cierta es la del bloque, no la del servidor ni la de cada fila de la tabla).',
    ...(input.blockNumber != null
      ? ['La fecha cierta es la del bloque (publicación de estas huellas): no la del servidor ni la de cada fila de la tabla.']
      : []),
    explorerUrl || '',
    input.merkleRoot ? `Raíz Merkle: ${input.merkleRoot}` : '',
    `Spec de hojas: ${specUrl} · dirección emisora publicada ahí`,
  ].filter(Boolean);
  doc.setFont('courier', 'normal');
  doc.setFontSize(6.5);
  const chainWrapped = chainLines.map((line) => doc.splitTextToSize(line, 178) as string[]);
  const chainH = 7 + chainWrapped.reduce((n, w) => n + w.length * 3.5, 0);
  drawSoftPanelMm(doc, 14, y, 182, chainH);
  doc.setFont('courier', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(...PDF_BRAND.textMain);
  let cy = y + 4.5;
  for (const wrapped of chainWrapped) {
    doc.text(wrapped, 16, cy);
    cy += wrapped.length * 3.5;
  }
  y += chainH + 3;

  if (input.payload) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...PDF_BRAND.textMain);
    doc.text('Payload UTF-8 registrado en la transacción', 14, y);
    y += 4;
    doc.setFont('courier', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(51, 65, 85);
    const payloadLines = doc.splitTextToSize(input.payload, 182);
    doc.text(payloadLines, 14, y);
    y += payloadLines.length * 3.2 + 2;
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7);
    doc.setTextColor(...PDF_BRAND.textMuted);
    doc.text(
      'El payload on-chain es una sola línea, sin saltos. Los cortes de renglón de este PDF son tipográficos.',
      14,
      y
    );
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    if (printed.payloadDigest && printed.payloadDigest === printed.computedDigest) {
      doc.setTextColor(21, 128, 61);
      doc.text('leavesDigest: las hojas impresas coinciden con el digest del payload v2.', 14, y);
      y += 5;
    }
  }

  const tableHead =
    input.kind === 'send'
      ? ['#', 'Destinatario', 'Teléfono', 'Estado']
      : ['#', 'Destinatario', 'Teléfono', 'Hecho', 'ART (UTC-3)'];

  const tableBody = leaves.map((leaf, i) => {
    const idx = String(leaf.leafIndex ?? i);
    const nombre = leaf.nombre || '—';
    const tel = maskPhoneForLote(leaf.telefono);
    if (input.kind === 'send') {
      return [idx, leaf.kind === 'error' ? `${nombre} (error)` : nombre, tel, loteHechoLabel(leaf.eventType, leaf.kind)];
    }
    return [idx, nombre, tel, loteHechoLabel(leaf.eventType, leaf.kind), formatEvidenceTimestampArtCell(leaf.occurredAt)];
  });

  autoTable(doc, {
    startY: Math.min(y + 2, 250),
    head: [tableHead],
    body: tableBody,
    margin: PDF_TABLE_MARGIN,
    tableWidth: 182,
    styles: { fontSize: 8, font: 'helvetica', cellPadding: 1.6, overflow: 'linebreak' },
    headStyles: { ...PDF_TABLE_HEAD, font: 'helvetica', fontSize: 7.5 },
    columnStyles:
      input.kind === 'send'
        ? { 0: { cellWidth: 10 }, 2: { cellWidth: 42 }, 3: { cellWidth: 36 } }
        : { 0: { cellWidth: 10 }, 1: { cellWidth: 'auto' }, 2: { cellWidth: 34 }, 3: { cellWidth: 38 }, 4: { cellWidth: 36 } },
  });

  let afterTable = lastAutoY(doc, y) + 4;
  afterTable = ensureY(doc, afterTable, 14);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...PDF_BRAND.textMain);
  doc.text('Hashes de hoja (mismo orden que la tabla; para el leavesDigest)', 14, afterTable);
  afterTable += 4;
  doc.setFont('courier', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(51, 65, 85);
  for (let i = 0; i < leaves.length; i++) {
    const leaf = leaves[i];
    const idx = leaf.leafIndex ?? i;
    const line = `${idx}  ${leaf.leafHash}`;
    const wrapped = doc.splitTextToSize(line, 182);
    afterTable = ensureY(doc, afterTable, wrapped.length * 3.2 + 1);
    doc.text(wrapped, 14, afterTable);
    afterTable += wrapped.length * 3.2 + 0.8;
  }

  afterTable = ensureY(doc, afterTable + 3, 20);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...PDF_BRAND.textMain);
  const judicial = doc.splitTextToSize(
    `Para la constancia individual de un destinatario (no este lote), pegá el hash de hoja de esa fila después de leaf=: ${individualUrl}`,
    182
  );
  doc.text(judicial, 14, afterTable);
  afterTable += judicial.length * 3.4 + 3;

  afterTable = ensureY(doc, afterTable, 12);
  doc.setFontSize(8);
  const positive = doc.splitTextToSize(lotePositiveStatement(input), 182);
  doc.text(positive, 14, afterTable);
  afterTable += positive.length * 3.6 + 3;

  afterTable = ensureY(doc, afterTable, 16);
  doc.setFontSize(6.5);
  doc.setTextColor(...PDF_BRAND.textMuted);
  const disclaimer = doc.splitTextToSize(
    'Este documento es una constancia técnica de lo pedido a WhatsApp/correo y de lo anclado en Polygon. ' +
      'No prueba por sí solo la identidad civil del titular del teléfono, ni que haya leído o comprendido el contenido, ni que la deuda declarada por el cliente sea cierta. ' +
      'DNI, monto y nombre se transcriben de la hoja Merkle (si es v2) o se omiten; no se toman de la base viva. ' +
      'La inmutabilidad la aporta la transacción citada, no este PDF: prueba que esas huellas existían a la hora de su bloque, mientras que las horas de la tabla son las de cada hecho. ' +
      'WhatsApp “entregado” significa que Meta informó entrega a un wa_id, no notificación fehaciente al deudor.',
    182
  );
  doc.text(disclaimer, 14, afterTable);

  stampPdfChromeMm(doc, {
    pagesWithFirstHeader: [1],
    continueTitle: () => docTitle,
    footerLine1: (page, pageCount) =>
      `${SITE_LEGAL_NAME} · ${PDF_SCHEMA.actaTanda} · lote ${input.batchId} · pág. ${page} de ${pageCount}`,
    footerLine2: () =>
      [input.verifyRef && `verify-ref: ${input.verifyRef}`, input.txHash].filter(Boolean).join('  ·  ') || undefined,
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
    waDeliveredWebhookPreserved?: boolean;
    waReadWebhookPreserved?: boolean;
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
    /** Preimagen de la hoja de envío: SHA-256(UTF-8(leafPayload)) = leafHash. */
    leafPayload?: string | null;
    leafIndex?: number | null;
    /** Hermanos desde la hoja hasta la raíz (spec §5). */
    proof?: string[] | null;
    templateSealHash?: string | null;
    merkleValid: boolean | null;
    onChainMatch: boolean | null;
  };
  events: Array<{
    type: string;
    present: boolean;
    occurredAt?: string;
    merkleValid?: boolean | null;
    txHash?: string;
    batchId?: string;
    merkleRoot?: string;
    leafHash?: string;
    leafPayload?: string | null;
    leafIndex?: number | null;
    proof?: string[] | null;
  }>;
  verifyRef?: string;
};

function checkLabel(ok: boolean | null | undefined): string {
  if (ok === true) return 'Sí';
  if (ok === false) return 'No';
  return 'Pendiente';
}

/**
 * Cuerpo tal como se imprime en la Parte I. El contentHash es SHA-256(UTF-8(trim(texto))) sobre el texto
 * sellado, byte a byte: se transcribe sin limpiar nada (ni HTML, ni líneas en blanco, ni espacios), para que
 * lo impreso sea exactamente lo hasheado. Si el texto sellado trae etiquetas, se imprimen tal cual.
 */
export function printedActaBody(raw: string): string {
  return String(raw || '').trim();
}

function canalLabel(canal?: string): string {
  if (canal === 'whatsapp') return 'WhatsApp';
  if (canal === 'ambos') return 'Correo electrónico y WhatsApp (envío mixto)';
  return 'Correo electrónico';
}

function isMixedCanal(canal?: string): boolean {
  return canal === 'ambos';
}

/** Espacios unificados para comparar cuerpo de correo vs globo de WhatsApp. */
export function normalizeActaBodyText(text: string): string {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** En mixtas con template de Meta el correo y el globo llevan el mismo BODY. */
export function mixedActaSharesMessageBody(emailBody: string, waBody?: string | null): boolean {
  const a = normalizeActaBodyText(emailBody);
  const b = normalizeActaBodyText(waBody || '');
  return Boolean(a && b && a === b);
}

function tableSectionRow(label: string): Array<{
  content: string;
  colSpan: number;
  styles: { fillColor: number[]; textColor: number[]; fontStyle: string; fontSize: number };
}> {
  return [
    {
      content: label,
      colSpan: 2,
      styles: {
        fillColor: [241, 245, 249],
        textColor: PDF_BRAND.textMain,
        fontStyle: 'bold',
        fontSize: 8,
      },
    },
  ];
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

function hechoFecha(
  iso?: string,
  opts?: { meta?: boolean; webhookPreserved?: boolean }
): [string, string] {
  if (!iso) return ['No consta a la fecha de esta constancia', 'Pendiente de registro'];
  if (opts?.meta) {
    return [
      formatTs(iso),
      opts.webhookPreserved
        ? 'Evento informado por Meta. Webhook autenticado y evidencia preservada'
        : 'Evento informado por Meta y registrado por Notificas',
    ];
  }
  return [formatTs(iso), 'Registrado por el sistema'];
}

export async function buildActaDestinatarioPdf(input: ActaDestinatarioInput): Promise<ArrayBuffer> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const explorerUrl = input.send.txHash ? `https://polygonscan.com/tx/${input.send.txHash}` : '';
  const verifyUrl = publicCertificateVerifyUrl({
    id: input.messageId,
    campaignId: input.campaignId,
    kind: 'campaign_acta_recipient',
    hash: input.contentHash || input.storedHash || undefined,
  });
  const email = input.recipientEmail && !isSyntheticEmail(input.recipientEmail) ? input.recipientEmail : '';
  const cuerpo = printedActaBody(input.cuerpoPersonalizado || '');
  const printedBodyHash = cuerpo ? await sha256Hex(cuerpo) : '';
  const printedBodyMatches = cuerpo && input.contentHash ? printedBodyHash === input.contentHash : null;
  const asunto = (input.asuntoPersonalizado || input.campaignAsunto || '').trim();
  const destinatario = input.recipientNombre || email || (input.evidenceSealed === false ? 'Destinatario no transcrito' : 'el destinatario');
  const remitente = input.orgNombre || 'la organización remitente';
  const publicationSentence = input.send.txHash
    ? 'La huella de esa copia se publicó después en Polygon (bloque y transacción en el anexo): la fecha cierta que aporta la cadena es la de ese bloque, no la del envío ni la de cada hecho.'
    : 'La huella de esa copia todavía no se publicó en Polygon.';
  const origenRows: string[][] = [
    [
      'Origen del texto y de las partes',
      input.evidenceSealed ? 'Copia guardada al enviar (registro de escritura única)' : 'Sin copia de escritura única del envío',
    ],
    [
      'Publicación de la huella',
      input.send.txHash ? 'Después, en Polygon; bloque y TX en el anexo' : 'Todavía no publicada en Polygon',
    ],
  ];

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
      isMixedCanal(input.canal)
        ? 'Envío mixto: un despacho por correo y otro por WhatsApp. El anexo técnico para perito consta al final.'
        : 'Destinado a jueces, abogados y funcionarios. El anexo técnico para perito consta al final.',
    ],
  });
  doc.setTextColor(...PDF_BRAND.textMain);

  try {
    const qr = await QRCode.toDataURL(verifyUrl, { margin: 0, width: 160 });
    doc.addImage(qr, 'PNG', 176, y, 18, 18);
    doc.setFontSize(6);
    doc.setTextColor(...PDF_BRAND.textMuted);
    doc.text('Validar', 179, y + 20);
    doc.setTextColor(...PDF_BRAND.textMain);
  } catch {
    /* QR opcional */
  }

  const idWidth = 155;
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
  if (explorerUrl || verifyUrl) y = Math.max(y, idStart + 24);

  if (input.evidenceSealed === false) {
    y = ensureY(doc, y, 16);
    drawWarnPanelMm(doc, 14, y - 4, 182, 14);
    doc.setTextColor(...PDF_BRAND.warnText);
    doc.setFontSize(8);
    y = writeWrapped(
      doc,
      'No hay copia de escritura única del envío. Esta constancia no transcribe identidad ni texto desde registros que se pueden modificar. El anexo técnico, si existe, muestra huellas y Merkle.',
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
    ? isMixedCanal(input.canal)
      ? `Notificas.com deja constancia de un envío mixto de ${remitente}${input.orgCuit ? ` (CUIT ${input.orgCuit})` : ''} a ${destinatario}, en la campaña «${input.campaignNombre}»: un correo${email ? ` a ${email}` : ''} y un WhatsApp${input.recipientTelefono ? ` al ${input.recipientTelefono}` : ''}. ` +
        `Son dos despachos independientes (SMTP y Meta), no un único mensaje duplicado. En el momento del envío el sistema guarda una copia de quién envió, a quién se dirigió y qué se envió por cada canal, en un registro de escritura única (WORM) de Notificas. Esa copia no se vuelve a armar después con datos actuales de la campaña. ${publicationSentence} ` +
        `Los hechos posteriores (aceptación del correo por el proveedor, o entrega y lectura que informe WhatsApp) se anotan aparte, según lo que esos terceros comunicaron después. No sustituyen ni modifican el texto original. El modo técnico de conservar y verificar esa copia consta en el anexo para perito.`
      : `Notificas.com deja constancia de una comunicación digital enviada por ${remitente}${input.orgCuit ? ` (CUIT ${input.orgCuit})` : ''} a ${destinatario}, en la campaña «${input.campaignNombre}». ` +
        `En el momento del envío el sistema guarda una copia de quién envió, a quién se dirigió y qué se envió, en un registro de escritura única (WORM) de Notificas. Esa copia no se vuelve a armar después con datos actuales de la campaña: lo transcrito en las páginas siguientes es exactamente lo que quedó registrado entonces. ${publicationSentence} ` +
        `Los hechos posteriores (aceptación del correo por el proveedor, o entrega y lectura que informe WhatsApp) se anotan aparte, según lo que esos terceros comunicaron después. No sustituyen ni modifican el texto original. El modo técnico de conservar y verificar esa copia consta en el anexo para perito.`
    : `No se transcribe el contenido ni la identidad desde registros que se pueden modificar. Consulte el anexo técnico y, si existe, la copia de escritura única del envío.`;
  y = writeWrapped(doc, declaracion, 14, y, 182, 4.2);
  y += 6;

  y = ensureY(doc, y, 20);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('Identificación de las partes y del envío', 14, y);
  y += 4;
  const mixed = isMixedCanal(input.canal);
  const identificacionBody: Array<string[] | ReturnType<typeof tableSectionRow>> = mixed
    ? [
        ['Remitente', `${remitente}${input.orgCuit ? `  ·  CUIT ${input.orgCuit}` : ''}`],
        ['Destinatario', destinatario],
        ...(input.recipientDni ? [['DNI / identificación', input.recipientDni]] : []),
        ...(input.recipientLegajo ? [['Legajo', input.recipientLegajo]] : []),
        ['Campaña', input.campaignNombre],
        ['Canal', canalLabel(input.canal)],
        ['Identificador interno', input.messageId],
        ...origenRows,
        ['Fecha de emisión', input.generatedAt],
        tableSectionRow('Canal correo electrónico'),
        ...(email ? [['Casilla de destino', email]] : [['Casilla de destino', 'No consignada']]),
        ...(asunto ? [['Asunto', asunto]] : []),
        ...(input.smtpMessageId
          ? [['ID SMTP del correo', input.smtpMessageId]]
          : [['ID SMTP del correo', 'No consta a la fecha de esta constancia']]),
        tableSectionRow('Canal WhatsApp'),
        ...(input.recipientTelefono
          ? [['Teléfono de destino', input.recipientTelefono]]
          : [['Teléfono de destino', 'No consignado']]),
        ...(input.wamid ? [['WAMID de WhatsApp', input.wamid]] : [['WAMID de WhatsApp', 'No consta']]),
        ...(input.phoneNumberId ? [['Phone Number ID (Meta)', input.phoneNumberId]] : []),
        ...(input.wabaId ? [['WABA ID (Meta)', input.wabaId]] : []),
      ]
    : [
        ['Remitente', `${remitente}${input.orgCuit ? `  ·  CUIT ${input.orgCuit}` : ''}`],
        ['Destinatario', destinatario],
        ...(input.recipientDni ? [['DNI / identificación', input.recipientDni]] : []),
        ...(input.recipientLegajo ? [['Legajo', input.recipientLegajo]] : []),
        ...(email ? [['Correo del destinatario', email]] : []),
        ...(input.recipientTelefono ? [['Teléfono', input.recipientTelefono]] : []),
        ['Campaña', input.campaignNombre],
        ...(input.canal === 'whatsapp' ? [] : asunto ? [['Asunto (correo)', asunto]] : []),
        ['Canal', canalLabel(input.canal)],
        ['Identificador de mensaje', input.messageId],
        ...(input.smtpMessageId ? [['SMTP Message-ID (aceptación)', input.smtpMessageId]] : []),
        ...(input.wamid ? [['WAMID (Meta)', input.wamid]] : []),
        ...(input.phoneNumberId ? [['Phone Number ID (Meta)', input.phoneNumberId]] : []),
        ...(input.wabaId ? [['WABA ID (Meta)', input.wabaId]] : []),
        ...origenRows,
        ['Fecha de emisión', input.generatedAt],
      ];
  autoTable(doc, {
    startY: y,
    theme: 'plain',
    margin: PDF_TABLE_MARGIN,
    styles: { fontSize: 8, cellPadding: 1.5, textColor: PDF_BRAND.textMain },
    tableWidth: 180,
    columnStyles: { 0: { cellWidth: 48, fontStyle: 'bold' }, 1: { cellWidth: 132 } },
    body: identificacionBody as never,
  });
  y = lastAutoY(doc, y) + 8;

  const waSent = input.whatsappSent || null;
  const showEmailContent = showsEmailContent(input.canal);
  const showWaContent = showsWhatsAppContent(input.canal) || Boolean(waSent);
  const sharesBody = mixed && mixedActaSharesMessageBody(cuerpo, waSent?.renderedBody);

  const renderEmailBlock = (opts?: { skipBody?: boolean }) => {
    const skipBody = opts?.skipBody === true;
    y = ensureY(doc, y, 16);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text(mixed ? 'Canal correo electrónico' : 'Contenido del mensaje remitido', 14, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    const emailCaption = !input.evidenceSealed
      ? 'El texto no se transcribe: no hay snapshot sellado.'
      : skipBody
        ? 'Lo que se despachó a la casilla. El cuerpo es el texto común de arriba: no se copia otra vez. Asunto e identificador SMTP son propios de este canal.'
        : mixed
          ? 'Texto que viajó en el correo (bandeja o lector), con variables ya sustituidas. Este bloque es el canal correo, no el globo de WhatsApp.'
          : 'Texto del correo y del lector, con variables ya sustituidas. Huella SHA-256 en el anexo técnico.';
    y = writeWrapped(doc, emailCaption, 14, y, 182, 3.6);
    y += 3;
    if (asunto) {
      y = ensureY(doc, y, 8);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);
      y = writeWrapped(doc, `Asunto: ${asunto}`, 14, y, 182, 3.8);
      y += 2;
    }
    if (!skipBody) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(15, 23, 42);
      if (cuerpo) {
        y = writeWrapped(doc, cuerpo, 14, y, 182, 4.2);
      } else {
        y = writeWrapped(doc, 'Sin texto de correo en snapshot sellado.', 14, y, 182, 4.2);
      }
    }
    y += 8;
  };

  const renderWhatsAppBlock = (opts?: { skipBody?: boolean }) => {
    const skipBody = opts?.skipBody === true;
    y = ensureY(doc, y, 16);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text('Canal WhatsApp', 14, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    if (!waSent) {
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
    const waCaption = skipBody
      ? 'Globo pedido a Meta. El cuerpo es el texto común de arriba. Encabezado, pie, template y variables son propios de WhatsApp.'
      : !waSent.renderedBody
        ? waSent.templateBodyMissing
          ? 'No se pudo lacrar el texto fijo de Meta en este envío. Se certifican el nombre del template, el idioma y las variables (piezas del mensaje). El WhatsApp sí se envió.'
          : 'No se almacena el texto fijo del template de Meta. Se transcriben las variables enviadas (ya sustituidas).'
        : mixed
          ? 'Globo pedido a Meta para este teléfono. Encabezado, pie y botones pueden diferir del correo; el identificador de este canal es el WAMID.'
          : 'Globo pedido a Meta, con variables ya sustituidas.';
    y = writeWrapped(doc, waCaption, 14, y, 182, 3.6);
    y += 3;
    if (waSent.renderedHeader) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);
      y = writeWrapped(doc, `Encabezado (WhatsApp): ${waSent.renderedHeader}`, 14, y, 182, 3.6);
      y += 2;
    }
    if (waSent.renderedBody && !skipBody) {
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
      y = writeWrapped(doc, `Pie (WhatsApp): ${waSent.renderedFooter}`, 14, y, 182, 3.6);
      y += 3;
    }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    y = writeWrapped(
      doc,
      `Template Meta: ${waSent.templateName} · ${waSent.templateLang}` +
        (waSent.templateHash ? ` · Hash del pedido a Meta: ${waSent.templateHash}` : '') +
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
        tableWidth: 180,
        headStyles: { ...PDF_TABLE_HEAD, fontSize: 8 },
        columnStyles: { 0: { cellWidth: 20 }, 1: { cellWidth: 34 } },
      });
      y = lastAutoY(doc, y) + 4;
    }
    if (waSent.buttons.length > 0) {
      for (const btn of waSent.buttons) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(15, 23, 42);
        const label = btn.text ? `Botón WhatsApp: ${btn.text}` : 'Botón URL WhatsApp';
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

  const renderSharedBodyBlock = () => {
    y = ensureY(doc, y, 16);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text('Texto del mensaje (común a correo y WhatsApp)', 14, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    y = writeWrapped(
      doc,
      input.evidenceSealed
        ? 'En esta campaña mixta el correo y WhatsApp llevan el mismo cuerpo: el BODY del template aprobado en Meta, con variables ya sustituidas. No son dos textos distintos. Abajo, cada canal detalla solo lo propio (asunto y SMTP en correo; encabezado, pie y template en WhatsApp). La huella SHA-256 del anexo es de este cuerpo.'
        : 'El texto no se transcribe: no hay snapshot sellado.',
      14,
      y,
      182,
      3.6
    );
    y += 3;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    if (cuerpo) {
      y = writeWrapped(doc, cuerpo, 14, y, 182, 4.2);
    } else {
      y = writeWrapped(doc, 'Sin texto de cuerpo en snapshot sellado.', 14, y, 182, 4.2);
    }
    y += 8;
  };

  if (mixed) {
    if (sharesBody) {
      renderSharedBodyBlock();
      renderEmailBlock({ skipBody: true });
      renderWhatsAppBlock({ skipBody: true });
    } else {
      renderEmailBlock();
      renderWhatsAppBlock();
    }
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
    mixed
      ? 'Envío mixto: cada fila indica el canal. La aceptación SMTP y la aceptación de Meta son hechos distintos. Un hecho pendiente en un canal no niega el despacho del otro.'
      : input.canal === 'whatsapp'
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
    const [envFecha, envObs] = hechoFecha(input.chronology.waEnviadoAt, { meta: true });
    const [entFecha, entObs] = hechoFecha(input.chronology.waEntregadoAt, {
      meta: true,
      webhookPreserved: input.chronology.waDeliveredWebhookPreserved,
    });
    const [leiFecha, leiObs] = hechoFecha(input.chronology.waLeidoAt, {
      meta: true,
      webhookPreserved: input.chronology.waReadWebhookPreserved,
    });
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
  const statements = mixed
    ? [
        'Esta Parte I relata dos despachos (correo y WhatsApp), a qué destino técnico de cada canal y qué informaron después los proveedores. No califica valor legal ni prueba por sí sola la identidad civil del receptor.',
        'La integridad del cuerpo común se puede comprobar con la huella SHA-256 y, si la tanda está anclada, con la transacción de Polygon. Alterar el texto hace que la huella deje de coincidir.',
        'Que el servidor de correo haya aceptado el mensaje no significa que haya llegado a la casilla. “Entregado” o “leído” de WhatsApp se consignan solo si Meta los informó; no equivalen a que una persona determinada haya tomado conocimiento. Un canal no prueba al otro.',
        `Emisión: ${input.generatedAt}.`,
      ]
    : [
        'Esta Parte I relata qué se pidió enviar, a qué destino técnico y qué informaron después los proveedores. No califica valor legal ni prueba por sí sola la identidad civil del receptor.',
        'La integridad del texto se puede comprobar con la huella SHA-256 y, si la tanda está anclada, con la transacción de Polygon. Alterar el texto hace que la huella deje de coincidir.',
        'Que el servidor de correo haya aceptado el mensaje no significa que haya llegado a la casilla. “Entregado” o “leído” de WhatsApp se consignan solo si Meta los informó; no equivalen a que una persona determinada haya tomado conocimiento.',
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
      'El recálculo no sustituye al snapshot: lo confronta. Si el PDF o el texto se alteran, el hash deja de coincidir. ' +
      'La publicación en Polygon de la huella de este registro es posterior al envío: la fecha cierta de la cadena es la de su bloque, no la del envío ni la de cada hecho.',
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
        ? 'Estado: íntegro — el texto y la foja coinciden con la huella publicada en Polygon.'
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
      ...(printedBodyMatches === null
        ? []
        : [['El texto impreso en la Parte I reproduce la huella de contenido (recalculado al emitir)', checkLabel(printedBodyMatches)]]),
      ['La foja entra en el árbol de su tanda', checkLabel(input.send.merkleValid)],
      ['La raíz coincide con la transacción en Polygon (lo verificó Notificas al emitir; el perito debe repetirlo en el explorador)', checkLabel(input.send.onChainMatch)],
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
  if (cuerpo) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(71, 85, 105);
    y = writeWrapped(
      doc,
      `Texto hasheado: ${new TextEncoder().encode(cuerpo).length} bytes UTF-8, ${cuerpo.split('\n').length} líneas. ` +
        'Los cortes de renglón dentro de un párrafo de la Parte I son tipográficos; los saltos reales del texto (incluidas las líneas en blanco) cuentan en el hash. ' +
        'Para que no haya ambigüedad se transcribe también en hexadecimal (UTF-8, una sola cadena; los cortes de renglón son tipográficos). ' +
        'Pasar ese hex a bytes y calcular SHA-256 reproduce la huella, p. ej. con: xxd -r -p texto.hex | sha256sum.',
      14,
      y - 2,
      182,
      3.4
    );
    y += 1;
    doc.setFont('courier', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(15, 23, 42);
    y = writeWrapped(doc, Array.from(new TextEncoder().encode(cuerpo), (b) => b.toString(16).padStart(2, '0')).join(''), 14, y, 182, 3);
    y += 4;
  }
  doc.setFont('helvetica', 'normal');

  // Pruebas de cada hoja (preimagen + camino Merkle). Los "Sí" de arriba son afirmaciones del emisor;
  // esto es lo que permite recalcularlos sin la base de datos (spec §5 y §6).
  const proofBlocks: Array<{
    label: string;
    batchId?: string | null;
    leafPayload?: string | null;
    leafHash?: string | null;
    leafIndex?: number | null;
    proof?: string[] | null;
    merkleRoot?: string | null;
    txHash?: string | null;
    occurredAt?: string;
    extra?: Array<[string, string]>;
  }> = [];
  if (input.send.txHash) {
    proofBlocks.push({
      label: 'Envío',
      batchId: input.send.batchId,
      leafPayload: input.send.leafPayload,
      leafHash: input.send.leafHash,
      leafIndex: input.send.leafIndex,
      proof: input.send.proof,
      merkleRoot: input.send.merkleRoot,
      txHash: input.send.txHash,
      extra: input.send.templateSealHash
        ? [['templateSealHash (último campo de la hoja de envío; es el «Hash plantilla» del lote)', input.send.templateSealHash]]
        : undefined,
    });
  }
  for (const ev of input.events) {
    if (!ev.present || (input.canal === 'whatsapp' && ev.type === 'email_read')) continue;
    proofBlocks.push({
      label: EVENT_LABEL[ev.type] || ev.type,
      batchId: ev.batchId,
      leafPayload: ev.leafPayload,
      leafHash: ev.leafHash,
      leafIndex: ev.leafIndex,
      proof: ev.proof,
      merkleRoot: ev.merkleRoot,
      txHash: ev.txHash,
      occurredAt: ev.occurredAt,
    });
  }

  const eventRows = input.events
    .filter((ev) => input.canal !== 'whatsapp' || ev.type !== 'email_read')
    .map((ev) => [
      EVENT_LABEL[ev.type] || ev.type,
      ev.present ? formatTs(ev.occurredAt) : 'Pendiente',
      ev.present ? checkLabel(ev.merkleValid ?? null) : '—',
      ev.present ? (ev.batchId || '—') : '—',
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
      head: [['Hecho', 'Fecha', 'En el árbol', 'Lote (la TX completa está en el detalle de abajo)']],
      body: eventRows,
      styles: { fontSize: 7, font: 'helvetica', cellPadding: 1.4 },
      margin: PDF_TABLE_MARGIN,
      headStyles: { ...PDF_TABLE_HEAD, fontSize: 7 },
    });
    y = lastAutoY(doc, y) + 8;
  }

  if (proofBlocks.length > 0) {
    y = ensureY(doc, y, 70);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text('Prueba de pertenencia al árbol, hoja por hoja', 14, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(51, 65, 85);
    y = writeWrapped(
      doc,
      'Cada bloque trae la preimagen de la hoja (una sola línea; los cortes de renglón son tipográficos), su SHA-256, el índice, los hermanos del camino y la raíz y la TX completas. ' +
        'Con eso se recalcula la raíz sin consultar a Notificas (pasos 6 a 8).',
      14,
      y,
      182,
      3.4
    );
    y += 3;

    const mono = (text: string, label: string) => {
      y = ensureY(doc, y, 10);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(100, 116, 139);
      doc.text(label, 14, y);
      y += 3;
      doc.setFont('courier', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(15, 23, 42);
      y = writeWrapped(doc, text, 14, y, 182, 3);
      y += 1;
    };

    for (const block of proofBlocks) {
      y = ensureY(doc, y, 36);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);
      doc.text(
        `${block.label}${block.occurredAt ? ` · ${formatTs(block.occurredAt)}` : ''} · lote ${block.batchId || '—'} · hoja #${
          typeof block.leafIndex === 'number' ? block.leafIndex : '—'
        }`,
        14,
        y
      );
      y += 4;
      if (block.leafPayload) {
        mono(block.leafPayload, 'leafPayload (UTF-8, una sola línea)');
      } else {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(...PDF_BRAND.warnText);
        y = writeWrapped(
          doc,
          'Preimagen no disponible en el registro de esta hoja: no se puede recalcular el hash a partir de este PDF.',
          14,
          y,
          182,
          3.4
        );
      }
      mono(block.leafHash || '—', 'leafHash = SHA-256(UTF-8(leafPayload))');
      for (const [k, v] of block.extra || []) mono(v, k);
      if (block.proof && block.proof.length > 0 && typeof block.leafIndex === 'number') {
        mono(
          block.proof.map((s, i) => `${i + 1}  ${s}`).join('\n'),
          `Hermanos desde la hoja hasta la raíz (índice ${block.leafIndex}; par: SHA-256(h|s), impar: SHA-256(s|h))`
        );
      } else if (block.proof && block.proof.length === 0) {
        mono('(sin hermanos: la tanda tiene una sola hoja y la raíz es la hoja)', 'Camino Merkle');
      } else {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(...PDF_BRAND.warnText);
        y = writeWrapped(doc, 'Sin camino Merkle registrado para esta hoja.', 14, y, 182, 3.4);
      }
      mono(block.merkleRoot || '—', 'Raíz Merkle (campo 5 del payload on-chain)');
      mono(block.txHash || '—', 'Transacción Polygon (completa)');
      y += 3;
    }
    doc.setFont('helvetica', 'normal');
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
    '2. Payload v2 de envío: CAMPAIGN_SEND|v2|{campaignId}|{batchId}|{merkleRoot}|{leafCount}|{timestamp}|{leavesDigest}|{templateSealHash?}. Una TX por tanda, no por persona. v1 no tiene leavesDigest.',
    '3. El template es el formulario de toda la campaña. Esta foja contiene los datos individualizados del destinatario, las variables efectivamente enviadas, el teléfono y el identificador WAMID correspondiente.',
    mixed && sharesBody
      ? '4. Recalcular SHA-256(UTF-8(trim(cuerpo))) del texto bajo «Texto del mensaje (común a correo y WhatsApp)»: debe coincidir con la huella de contenido. El encabezado y el pie de WhatsApp no entran en esa huella.'
      : '4. Recalcular SHA-256(UTF-8(trim(texto_plano_personalizado))) del texto transcrito en la Parte I: debe coincidir con la huella de contenido.',
    '5. Si se altera esta foja, la raíz Merkle deja de coincidir con la registrada on-chain.',
    `6. Hoja: SHA-256(UTF-8(leafPayload)) debe dar el leafHash del bloque correspondiente. En la hoja de envío el campo 12 es la huella de contenido y el 17 el templateSealHash; en una hoja de evento el campo 7 es el leafHash de envío (sendLeafHash). Formato completo: ${publicAppBase()}${LEAF_SPEC_PATH}.`,
    '7. Camino: h = leafHash; i = índice. Por cada hermano s, en orden: si i es par h = SHA-256(UTF-8(h + "|" + s)), si es impar h = SHA-256(UTF-8(s + "|" + h)); luego i = floor(i / 2). El resultado final debe ser la raíz Merkle de la TX de esa tanda (campo 5 del payload).',
    '8. Publicación: cada TX figura completa arriba. El timestamp de su bloque es la fecha cierta de la publicación de esas huellas, no la del hecho; la fecha de cada hecho está en su hoja (occurredAt). El orden en que se minaron las TX no prueba el orden de los hechos: el vínculo entre un hecho y su envío es el sendLeafHash.',
  ];
  for (const line of steps) {
    y = writeWrapped(doc, line, 14, y, 182, 3.5);
    y += 1;
  }
  y += 4;
  doc.setTextColor(71, 85, 105);
  y = writeWrapped(
    doc,
    'Este anexo es una constancia técnica de un destinatario. No es notificación fehaciente ni prueba de la deuda. ' +
      'La inmutabilidad del registro la aporta la transacción citada, no este PDF. ' +
      'La transacción prueba que la huella existía a la hora de su bloque; el momento del envío y de cada hecho surge de los datos de la hoja y, para entrega y lectura, de lo que informó Meta. ' +
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
