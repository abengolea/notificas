import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import QRCode from 'qrcode';

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
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleString('es-AR');
}

function isSyntheticEmail(email: string) {
  return email.endsWith('@notificas.internal') || email.endsWith('@wa.internal');
}

export async function buildActaTandaPdf(input: ActaTandaInput): Promise<ArrayBuffer> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const kindLabel = input.kind === 'send' ? 'ENVÍO' : 'HECHOS (recepción / lectura)';
  const explorerUrl = input.txHash ? `https://polygonscan.com/tx/${input.txHash}` : '';
  const anchored = input.status === 'anchored' && Boolean(input.merkleRoot && input.txHash);

  doc.setFillColor(13, 148, 136);
  doc.rect(0, 0, 210, 28, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.text('ACTA DE INTEGRIDAD DE TANDA', 14, 13);
  doc.setFontSize(9);
  doc.text('Notificas — Comunicaciones certificadas en Polygon', 14, 20);
  doc.setTextColor(15, 23, 42);

  if (explorerUrl) {
    try {
      const qr = await QRCode.toDataURL(explorerUrl, { margin: 0, width: 160 });
      doc.addImage(qr, 'PNG', 176, 32, 20, 20);
      doc.setFontSize(6);
      doc.setTextColor(100, 116, 139);
      doc.text('Ver TX', 181, 55);
      doc.setTextColor(15, 23, 42);
    } catch {
      /* QR opcional */
    }
  }

  let y = 36;
  doc.setFontSize(10);
  doc.text(`Organización: ${input.orgNombre}${input.orgCuit ? `  ·  CUIT ${input.orgCuit}` : ''}`, 14, y);
  y += 6;
  doc.text(`Campaña: ${input.campaignNombre}`, 14, y);
  y += 5;
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(`ID campaña: ${input.campaignId}`, 14, y);
  if (input.campaignAsunto) {
    y += 5;
    const asunto = doc.splitTextToSize(`Asunto: ${input.campaignAsunto}`, 155);
    doc.text(asunto, 14, y);
    y += asunto.length * 4;
  }
  y += 6;
  doc.setTextColor(15, 23, 42);
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
  doc.setTextColor(71, 85, 105);
  doc.text(`Acta generada: ${input.generatedAt}`, 14, y);
  y += 8;

  if (!anchored) {
    doc.setFillColor(254, 243, 199);
    doc.rect(14, y - 4, 182, 10, 'F');
    doc.setTextColor(146, 64, 14);
    doc.setFontSize(8);
    doc.text(
      'Esta tanda todavía no está anclada en blockchain. El listado es informativo; no constituye prueba on-chain.',
      16,
      y + 2
    );
    y += 12;
    doc.setTextColor(15, 23, 42);
  }

  doc.setFillColor(248, 250, 252);
  doc.rect(14, y, 182, input.kind === 'send' ? 42 : 38, 'F');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
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
    doc.setTextColor(13, 148, 136);
    doc.setFontSize(7);
    doc.text(explorerUrl, 16, y + 30);
  }
  y += input.kind === 'send' ? 46 : 42;

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
          '2. El payload es CAMPAIGN_SEND|v1|{campaignId}|{batchId}|{merkleRoot}|{leafCount}|{timestamp}.',
          '3. Recalcular SHA-256(UTF-8(trim(texto_plano_personalizado))) de un destinatario: debe coincidir con su contentHash.',
          '4. La hoja es SHA-256(v1|send|campaignId|messageId|email|telefono|contentHash|adjuntos|smtp|wamid).',
          '5. Con la prueba Merkle (hermano a hermano: SHA-256(left|right)) se llega a la raíz. Si coincide con la TX, el contenido no se modificó.',
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
    styles: { fontSize: 6, font: 'courier', cellPadding: 1.2, overflow: 'ellipsize' },
    headStyles: { fillColor: [13, 148, 136], font: 'helvetica', fontSize: 7, textColor: 255 },
    columnStyles:
      input.kind === 'send'
        ? { 0: { cellWidth: 10 }, 4: { cellWidth: 42 }, 5: { cellWidth: 42 } }
        : { 0: { cellWidth: 10 }, 5: { cellWidth: 48 } },
    didDrawPage: (data) => {
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text(
        `Acta ${input.batchId}  ·  ${input.campaignNombre}  ·  pág. ${data.pageNumber}`,
        14,
        287
      );
      if (input.verifyRef) {
        doc.text(`verify-ref: ${input.verifyRef}`, 14, 291);
      }
      if (input.txHash) {
        doc.text(input.txHash.slice(0, 18) + '…', 150, 287);
      }
    },
  });

  const finalY =
    (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y;
  let footY = finalY + 8;
  if (footY > 270) {
    doc.addPage();
    footY = 20;
  }
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(71, 85, 105);
  const disclaimer = doc.splitTextToSize(
    'Este documento es una constancia técnica oponible: deja asentado el contenido (o el hecho) incluido en la tanda y el ancla pública en Polygon Mainnet. ' +
      'La inmutabilidad la aporta la transacción citada, no este PDF. ' +
      'Si se altera una sola foja, la raíz Merkle deja de coincidir con la registrada on-chain. ' +
      'Los envíos individuales (fuera de campaña) se certifican con otra transacción por mensaje.',
    182
  );
  doc.text(disclaimer, 14, footY);

  return doc.output('arraybuffer') as ArrayBuffer;
}

export type ActaDestinatarioInput = {
  orgNombre: string;
  orgCuit?: string;
  campaignId: string;
  campaignNombre: string;
  campaignAsunto?: string;
  generatedAt: string;
  recipientNombre: string;
  recipientEmail: string;
  recipientTelefono?: string;
  recipientDni?: string;
  recipientLegajo?: string;
  intact: boolean;
  summary: string;
  contentHash: string;
  storedHash: string | null;
  contentMatch: boolean;
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

export async function buildActaDestinatarioPdf(input: ActaDestinatarioInput): Promise<ArrayBuffer> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const explorerUrl = input.send.txHash ? `https://polygonscan.com/tx/${input.send.txHash}` : '';
  const email = input.recipientEmail && !isSyntheticEmail(input.recipientEmail) ? input.recipientEmail : '';

  doc.setFillColor(13, 148, 136);
  doc.rect(0, 0, 210, 28, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.text('ACTA INDIVIDUAL DE DESTINATARIO', 14, 13);
  doc.setFontSize(9);
  doc.text('Notificas — Constancia puntual para una persona de la campaña', 14, 20);
  doc.setTextColor(15, 23, 42);

  if (explorerUrl) {
    try {
      const qr = await QRCode.toDataURL(explorerUrl, { margin: 0, width: 160 });
      doc.addImage(qr, 'PNG', 176, 32, 20, 20);
      doc.setFontSize(6);
      doc.setTextColor(100, 116, 139);
      doc.text('Ver TX', 181, 55);
      doc.setTextColor(15, 23, 42);
    } catch {
      /* QR opcional */
    }
  }

  let y = 36;
  doc.setFontSize(10);
  doc.text(`Organización: ${input.orgNombre}${input.orgCuit ? `  ·  CUIT ${input.orgCuit}` : ''}`, 14, y);
  y += 6;
  doc.text(`Campaña: ${input.campaignNombre}`, 14, y);
  y += 5;
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(`ID campaña: ${input.campaignId}`, 14, y);
  if (input.campaignAsunto) {
    y += 5;
    const asunto = doc.splitTextToSize(`Asunto: ${input.campaignAsunto}`, 155);
    doc.text(asunto, 14, y);
    y += asunto.length * 4;
  }
  y += 6;

  doc.setFillColor(248, 250, 252);
  doc.rect(14, y, 182, 28, 'F');
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(12);
  doc.text(input.recipientNombre || 'Sin nombre', 16, y + 8);
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
  doc.text(idLine || '—', 16, y + 15);
  doc.setFontSize(8);
  doc.setTextColor(input.intact ? 4 : 146, input.intact ? 120 : 64, input.intact ? 87 : 14);
  doc.text(input.intact ? 'Estado: íntegro — coincide con el lacre en Polygon' : `Estado: ${input.summary}`, 16, y + 23);
  y += 34;

  if (!input.send.txHash) {
    doc.setFillColor(254, 243, 199);
    doc.rect(14, y - 4, 182, 10, 'F');
    doc.setTextColor(146, 64, 14);
    doc.setFontSize(8);
    doc.text(
      'Esta persona todavía no está en una tanda cerrada. El acta es informativa; no constituye prueba on-chain.',
      16,
      y + 2
    );
    y += 12;
    doc.setTextColor(15, 23, 42);
  }

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(9);
  doc.text('Comprobaciones', 14, y);
  y += 6;
  autoTable(doc, {
    startY: y,
    theme: 'plain',
    styles: { fontSize: 8, cellPadding: 1.4, textColor: [15, 23, 42] },
    columnStyles: { 0: { cellWidth: 130 }, 1: { cellWidth: 50, fontStyle: 'bold' } },
    body: [
      ['El texto actual coincide con la huella guardada', checkLabel(input.contentMatch)],
      ['La foja entra en el árbol de su tanda', checkLabel(input.send.merkleValid)],
      ['La raíz coincide con la transacción en Polygon', checkLabel(input.send.onChainMatch)],
    ],
  });
  y = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y;
  y += 8;

  doc.setFillColor(248, 250, 252);
  doc.rect(14, y, 182, 42, 'F');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
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
    doc.setTextColor(13, 148, 136);
    doc.setFontSize(7);
    doc.text(explorerUrl, 16, y + 35);
  }
  y += 48;
  doc.setFont('helvetica', 'normal');

  const eventRows = input.events.map((ev) => [
    EVENT_LABEL[ev.type] || ev.type,
    ev.present ? formatTs(ev.occurredAt) : 'Pendiente',
    ev.present ? checkLabel(ev.merkleValid ?? true) : '—',
    ev.txHash || '—',
  ]);
  if (eventRows.length > 0) {
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(9);
    doc.text('Hechos posteriores', 14, y);
    y += 4;
    autoTable(doc, {
      startY: y,
      head: [['Hecho', 'Fecha', 'En el árbol', 'TX']],
      body: eventRows,
      styles: { fontSize: 7, font: 'helvetica', cellPadding: 1.4, overflow: 'ellipsize' },
      headStyles: { fillColor: [13, 148, 136], fontSize: 7, textColor: 255 },
      columnStyles: { 3: { cellWidth: 52, font: 'courier', fontSize: 6 } },
    });
    y = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y;
    y += 8;
  }

  if (y > 250) {
    doc.addPage();
    y = 20;
  }
  doc.setFontSize(7);
  doc.setTextColor(51, 65, 85);
  const steps = [
    'Cómo verificar: abrir la transacción en polygonscan.com y decodificar Input Data (UTF-8).',
    'El payload de envío es CAMPAIGN_SEND|v1|{campaignId}|{batchId}|{merkleRoot}|{leafCount}|{timestamp}.',
    'Recalcular SHA-256 del texto personalizado de esta persona: debe coincidir con la huella de contenido.',
    'Si se altera esta foja, la raíz Merkle deja de coincidir con la registrada on-chain.',
  ];
  for (const line of steps) {
    const wrapped = doc.splitTextToSize(line, 182);
    doc.text(wrapped, 14, y);
    y += wrapped.length * 3.5 + 1;
  }
  y += 4;
  const disclaimer = doc.splitTextToSize(
    'Este documento es una constancia técnica oponible de un destinatario puntual. ' +
      'La inmutabilidad la aporta la transacción citada, no este PDF. ' +
      `Acta generada: ${input.generatedAt}.`,
    182
  );
  doc.setTextColor(71, 85, 105);
  doc.text(disclaimer, 14, y);
  if (input.verifyRef) {
    y += disclaimer.length * 3.4 + 4;
    doc.setFontSize(6);
    doc.text(`verify-ref: ${input.verifyRef}`, 14, Math.min(y, 288));
  }

  return doc.output('arraybuffer') as ArrayBuffer;
}
