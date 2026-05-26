import jsPDF from 'jspdf';
import fs from 'fs';
import path from 'path';
import { computeContentHash } from './certification';

interface MailMessageContent {
  html?: string;
  text?: string;
  subject?: string;
  content?: string; // Contenido real del mensaje (sin template de email)
}

interface MailTracking {
  token?: string;
  sentAt?: any;
  opened?: boolean;
  openedAt?: any;
  openCount?: number;
  clickCount?: number;
  readConfirmed?: boolean;
  readConfirmedAt?: any;
  movements?: any[];
}

interface MailAttachment {
  id?: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  hash?: string;
  integrityCertificate?: any;
}

interface MailData {
  from?: string;
  to?: string;
  senderName?: string;
  recipientEmail?: string;
  readerUrl?: string;
  message?: MailMessageContent;
  delivery?: {
    state?: string;
    time?: any;
    info?: string;
  };
  tracking?: MailTracking;
  attachments?: MailAttachment[];
  polygonCertifications?: {
    send?: string;
    receive?: string;
    read?: string;
    contentHash?: string;
  };
}

interface CertificateData {
  messageId: string;
  mailData: MailData;
  movements: any[];
  attachments: any[];
}

const MOVEMENT_TYPE_LABELS: Record<string, string> = {
  email_sent: 'Correo enviado',
  email_opened: 'Correo abierto (pixel)',
  reader_magic_open: 'Acceso fehaciente al reader digital',
  app_opened: 'Apertura en app web',
  message_received: 'Mensaje recibido',
  read_confirmed: 'Lectura confirmada',
  link_clicked: 'Acceso a enlace (correo)',
  whatsapp_sent: 'Mensaje de WhatsApp enviado',
  whatsapp_delivered: 'WhatsApp entregado al dispositivo',
  whatsapp_read: 'WhatsApp leído por el destinatario',
  whatsapp_failed: 'WhatsApp no entregado',
  whatsapp_link_clicked: 'Acceso desde mensaje de WhatsApp',
  attachment_downloaded: 'Descarga de adjunto',
  document_viewed: 'Documento visualizado',
  fallback_access: 'Ingreso por enlace alternativo',
  certificate_downloaded: 'Certificado PDF descargado y anclado en Polygon',
};

// Colores alineados con la marca Notificas (globals.css: primary HSL 186 78% 37%)
// Bordes y grises ligeramente más oscuros para legibilidad en impresión en blanco y negro
const COLORS = {
  primary: [19, 159, 167] as [number, number, number], // Teal Notificas - hsl(186 78% 37%)
  primaryDark: [14, 110, 115] as [number, number, number], // Teal oscuro para títulos
  border: [165, 178, 182] as [number, number, number],
  bgSoft: [232, 240, 242] as [number, number, number],
  textMain: [17, 24, 39] as [number, number, number], // #111827 - texto principal
  textMuted: [72, 82, 90] as [number, number, number],
  success: [34, 197, 94] as [number, number, number], // #22c55e - verde éxito
  successBg: [220, 252, 231] as [number, number, number] // #dcfce7 - fondo verde claro
};

function getMovementLabel(type?: string) {
  if (!type) return 'Movimiento registrado';
  const normalized = type.toLowerCase();
  return MOVEMENT_TYPE_LABELS[normalized] || type.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function getMovementBrowserLabel(browser?: string) {
  if (!browser) return 'N/A';
  switch (browser) {
    case 'Server':
      return 'Servidor';
    case 'WhatsApp Cloud API':
      return 'Sistema (WhatsApp de Meta)';
    default:
      return browser;
  }
}

/** Ruta fija del visor en la app (no expira como las URLs firmadas de Storage). Requiere iniciar sesión. */
function stableDashboardAttachmentUrl(messageId: string, attachmentId: string): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:9006').replace(/\/$/, '');
  return `${base}/dashboard/pdf-viewer/${encodeURIComponent(messageId)}/${encodeURIComponent(attachmentId)}`;
}

function attachmentDisplayName(att: MailAttachment & Record<string, unknown>, index: number): string {
  const n = att.fileName || (att as { name?: string }).name;
  return typeof n === 'string' && n.trim() ? n : `Adjunto ${index + 1}`;
}

function attachmentStableId(att: MailAttachment & Record<string, unknown>, index: number, messageId: string): string {
  if (att.id && String(att.id).trim()) return String(att.id);
  return `${messageId}_${index}`;
}

export async function generateCertificatePDF(data: CertificateData): Promise<Blob> {
  const { messageId, mailData, movements = [], attachments = [] } = data;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4'
  });

  // Metadata del PDF para accesibilidad y profesionalismo
  doc.setProperties({
    title: `Certificado de Lectura - ${messageId}`,
    subject: 'Certificado oficial de mensaje certificado por Notificas.com',
    creator: 'Notificas.com - Sistema de Notificaciones Fehacientes Digitales',
    keywords: 'certificado, notificación, blockchain, mensaje, lectura, legal',
    author: 'Notificas.com'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 42;
  const emissionDate = new Date();

  const toDate = (value?: any): Date | null => {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (typeof value === 'string') return new Date(value);
    if (typeof value === 'number') return new Date(value);
    if (typeof value === 'object' && typeof value.seconds === 'number') {
      return new Date(value.seconds * 1000);
    }
    return null;
  };

  const formatDate = (value?: any) => {
    const date = toDate(value);
    return date ? date.toLocaleString('es-ES') : 'No disponible';
  };

  const sanitizeHtml = (html?: string) => {
    if (!html) return '';
    return html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const setTextColor = (color: [number, number, number]) => {
    doc.setTextColor(color[0], color[1], color[2]);
  };

  const drawHorizontalRule = (y: number) => {
    doc.setDrawColor(...COLORS.border);
    doc.setLineWidth(0.65);
    doc.line(margin, y, pageWidth - margin, y);
  };

  const drawBox = (x: number, y: number, width: number, height: number, fill: boolean = false) => {
    if (fill) {
      doc.setFillColor(...COLORS.bgSoft);
      doc.rect(x, y, width, height, 'FD');
    } else {
      doc.setFillColor(255, 255, 255);
      doc.rect(x, y, width, height, 'FD');
    }
    doc.setDrawColor(...COLORS.border);
    doc.setLineWidth(0.5);
    doc.rect(x, y, width, height, 'S');
  };

  const contentWidth = pageWidth - margin * 2;
  /** Regla + pie del PDF; si es bajo, el cuerpo invade el bloque del footer */
  const FOOTER_RESERVE_PT = 72;
  const contentBottom = pageHeight - margin - FOOTER_RESERVE_PT;
  let yPosition = margin + 70;

  const ensureSpace = (space: number) => {
    if (yPosition + space > contentBottom) {
      doc.addPage();
      drawPageHeader(false, doc.getNumberOfPages());
      // drawPageHeader ya fija yPosition por debajo del bloque de cabecera; no sobrescribir
    }
  };

  const writeTextBlock = (
    text: string,
    fontSize: number,
    lineHeight: number,
    options: { bold?: boolean; color?: [number, number, number]; italics?: boolean; monospace?: boolean } = {}
  ) => {
    if (!text) return;
    const fontFamily = options.monospace ? 'courier' : 'helvetica';
    doc.setFont(fontFamily, options.bold ? 'bold' : options.italics ? 'italic' : 'normal');
    doc.setFontSize(fontSize);
    setTextColor(options.color || COLORS.textMain);

    // Para campos monospace (URLs, IDs), permitir corte en cualquier carácter
    const lines = options.monospace 
      ? doc.splitTextToSize(text, contentWidth - 20)
      : doc.splitTextToSize(text, contentWidth);
    const blockHeight = lines.length * lineHeight;
    ensureSpace(blockHeight + 6);

    lines.forEach((line: string) => {
      doc.text(line, margin + (options.monospace ? 10 : 0), yPosition);
      yPosition += lineHeight;
    });

    yPosition += 6;
  };

  const drawSectionTitle = (title: string, level: 1 | 2 = 1) => {
    ensureSpace(level === 1 ? 34 : 24);
    if (level === 1) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      setTextColor(COLORS.primaryDark);
      doc.text(title, margin, yPosition);
      yPosition += 10;
      doc.setDrawColor(...COLORS.primary);
      doc.setLineWidth(0.75);
      drawHorizontalRule(yPosition);
      doc.setDrawColor(...COLORS.border);
      doc.setLineWidth(0.5);
      yPosition += 16;
    } else {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      setTextColor(COLORS.primaryDark);
      doc.text(title, margin, yPosition);
      yPosition += 18;
    }
  };

  const drawInfoBox = (rows: Array<{ label: string; value: string; monospace?: boolean }>, columns = 1, withBackground = true) => {
    const lineHeight = 16;
    const padding = 12;
    const boxY = yPosition;
    
    // Calcular altura dinámica
    let totalHeight = padding * 2;
    rows.forEach((entry) => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      const value = entry.value || 'No disponible';
      const isMono = entry.monospace || value.includes('http') || value.includes('@') || value.length > 50;
      const textLines = isMono 
        ? doc.splitTextToSize(value, contentWidth - padding * 2 - 40)
        : doc.splitTextToSize(value, contentWidth - padding * 2 - 40);
      totalHeight += 14 + (textLines.length * 14); // label + value lines
    });
    
    const boxHeight = totalHeight;
    ensureSpace(boxHeight + 8);
    drawBox(margin, boxY, contentWidth, boxHeight, withBackground);

    let currentY = boxY + padding + 12;

    rows.forEach((entry) => {
      const x = margin + padding;
      
      // Label en Title Case (no mayúsculas)
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      setTextColor(COLORS.textMuted);
      const labelText = entry.label.charAt(0).toUpperCase() + entry.label.slice(1).toLowerCase();
      doc.text(`${labelText}:`, x, currentY);

      // Value
      const value = entry.value || 'No disponible';
      const isMono = entry.monospace || value.includes('http') || value.includes('@') || value.length > 50;
      
      doc.setFont(isMono ? 'courier' : 'helvetica', 'normal');
      doc.setFontSize(11);
      setTextColor(COLORS.textMain);
      const textLines = isMono 
        ? doc.splitTextToSize(value, contentWidth - padding * 2 - 40)
        : doc.splitTextToSize(value, contentWidth - padding * 2 - 40);
      
      let offsetY = currentY + 14;
      textLines.forEach((line: string) => {
        doc.text(line, x + 4, offsetY);
        offsetY += 14;
      });
      
      currentY = offsetY + 6;
    });

    yPosition = boxY + boxHeight + 12;
  };

  const CELL_LINE_HEIGHT = 13;

  const drawTable = (headers: string[], rows: string[][], columnWidths: number[]) => {
    if (!rows.length) return;

    const headerHeight = 22;
    const rowPadding = 8;

    // Calcular altura total aproximada de la tabla para evitar cortes
    const estimatedHeight = headerHeight + rows.length * 28 + 12;
    ensureSpace(estimatedHeight + 20);

    doc.setFillColor(...COLORS.bgSoft);
    doc.rect(margin, yPosition - 6, contentWidth, headerHeight + 6, 'F');

    doc.setDrawColor(...COLORS.primary);
    doc.setLineWidth(0.6);
    doc.rect(margin, yPosition - 6, contentWidth, headerHeight + 6, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    setTextColor(COLORS.primaryDark);

    let xCursor = margin + 6;
    headers.forEach((header, index) => {
      const headerText = header.split(' ').map((word) =>
        word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
      ).join(' ');
      doc.text(headerText, xCursor, yPosition + 6);
      xCursor += columnWidths[index];
    });

    yPosition += headerHeight + 6;

    // Table rows
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    setTextColor(COLORS.textMain);

    rows.forEach((row, rowIndex) => {
      const linesPerCell = row.map((cell, index) =>
        doc.splitTextToSize(cell || 'N/A', columnWidths[index] - 10)
      );
      const rowHeight =
        Math.max(...linesPerCell.map((lines) => lines.length), 1) * CELL_LINE_HEIGHT + rowPadding * 2;
      ensureSpace(rowHeight);

      // Row background (alternate)
      if (rowIndex % 2 === 0) {
        doc.setFillColor(255, 255, 255);
      } else {
        doc.setFillColor(248, 252, 252);
      }
      doc.rect(margin, yPosition - 2, contentWidth, rowHeight, 'F');

      // Row border
      doc.setDrawColor(...COLORS.border);
      doc.rect(margin, yPosition - 2, contentWidth, rowHeight, 'S');

      // Cell content
      let x = margin + 6;
      linesPerCell.forEach((lines: string[], columnIndex) => {
        let y = yPosition + 12;

        lines.forEach((line: string) => {
          doc.text(line, x, y);
          y += CELL_LINE_HEIGHT;
        });
        
        // Cell border
        if (columnIndex < headers.length - 1) {
          doc.setDrawColor(...COLORS.border);
          doc.line(
            x + columnWidths[columnIndex] - 6,
            yPosition - 2,
            x + columnWidths[columnIndex] - 6,
            yPosition + rowHeight - 2
          );
        }

        x += columnWidths[columnIndex];
      });

      yPosition += rowHeight;
    });

    yPosition += 14;
  };

  const drawPageHeader = (isFirstPage: boolean, pageNumber: number) => {
    const headerY = margin;
    
    // Logo Notificas (si existe en public/)
    try {
      const logoPath = path.join(process.cwd(), 'public', 'notificasLogo.jpg');
      if (fs.existsSync(logoPath)) {
        const logoBase64 = fs.readFileSync(logoPath, { encoding: 'base64' });
        const logoW = 36;
        const logoH = 36;
        doc.addImage(logoBase64, 'JPEG', pageWidth / 2 - logoW / 2, headerY, logoW, logoH);
      }
    } catch {
      // Logo opcional; si falla, continuar sin él
    }
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(17);
    setTextColor(COLORS.primaryDark);
    doc.text('Notificas.com', pageWidth / 2, headerY + 42, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    setTextColor(COLORS.textMuted);
    doc.text(
      'Sistema de notificaciones fehacientes digitales',
      pageWidth / 2,
      headerY + 55,
      { align: 'center' }
    );
    
    drawHorizontalRule(headerY + 66);

    if (isFirstPage) {
      yPosition = headerY + 82;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      setTextColor(COLORS.textMain);
      doc.text('Certificado oficial de lectura', pageWidth / 2, yPosition, { align: 'center' });

      drawHorizontalRule(yPosition + 12);

      yPosition += 30;
    } else {
      const continuationTitleY = headerY + 78;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      setTextColor(COLORS.primaryDark);
      doc.text('Certificado oficial de lectura', margin, continuationTitleY);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      setTextColor(COLORS.textMuted);
      doc.text(`Página ${pageNumber}`, pageWidth - margin, continuationTitleY, {
        align: 'right',
      });
      drawHorizontalRule(continuationTitleY + 16);
      yPosition = continuationTitleY + 32;
    }
  };

  const drawFooter = (pageNumber: number, pageCount: number) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    setTextColor(COLORS.textMuted);

    const line1 = `Notificas.com · notificaciones fehacientes digitales`;
    const line2 = `ID de certificado: ${messageId} · Página ${pageNumber} de ${pageCount}`;
    const maxW = contentWidth - 16;
    const lines1 = doc.splitTextToSize(line1, maxW);
    const lines2 = doc.splitTextToSize(line2, maxW);
    const allLines = [...lines1, ...lines2];
    const lineHeight = 12;
    /** Línea base de la última línea del pie, con margen respecto al borde inferior de la hoja */
    const lastBaseline = pageHeight - margin - 10;
    const firstBaseline = lastBaseline - (allLines.length - 1) * lineHeight;
    /** Regla siempre por encima del bloque de texto (antes cortabar la 2.ª línea) */
    const ruleGapPt = 11;
    drawHorizontalRule(firstBaseline - ruleGapPt);

    let y = firstBaseline;
    allLines.forEach((ln) => {
      doc.text(ln, pageWidth / 2, y, { align: 'center' });
      y += lineHeight;
    });
  };

  drawPageHeader(true, 1);

  // ========================================
  // SECCIÓN 1: RESUMEN EJECUTIVO
  // ========================================
  // Cuadro resumen con datos esenciales para lectura rápida
  const deliveryState = (mailData.delivery?.state || 'Pendiente de notificar').toString().replace(/_/g, ' ');
  const readStatus = mailData.tracking?.readConfirmed ? 'Lectura acreditada' : 'Lectura pendiente';
  const openCount = mailData.tracking?.openCount ?? 0;
  const clickCount = mailData.tracking?.clickCount ?? 0;
  const movementCount = movements.length;
  const attachmentsCount = attachments.length;

  // Datos clave en dos columnas - formato destacado para impresión B&N
  // Estados en mayúsculas para mejor legibilidad
  const formatState = (state: string) => {
    return state.toUpperCase().replace(/_/g, ' ');
  };
  
  const summaryLeft = [
    { label: 'Fecha de emisión', value: emissionDate.toLocaleString('es-ES') },
    { label: 'Estado de entrega', value: formatState(deliveryState) },
    { label: 'Estado de lectura', value: formatState(readStatus) }
  ];
  
  const summaryRight = [
    { label: 'Identificador de mensaje', value: messageId, monospace: true },
    { label: 'Aperturas registradas', value: `${openCount}` },
    { label: 'Adjuntos certificados', value: `${attachmentsCount}` }
  ];
  
  // Calcular altura dinámica del cuadro de resumen
  const colWidth = (contentWidth - 28) / 2;
  const colSpacing = 14;
  
  // Precalcular alturas por fila (evitar solapamiento entre columnas)
  const leftRows = summaryLeft.map((item) => {
    const valueLines = doc.splitTextToSize(item.value || 'No disponible', colWidth - 20);
    return { item, valueLines };
  });
  const rightRows = summaryRight.map((item) => {
    const valueLines = doc.splitTextToSize(item.value || 'No disponible', colWidth - 20);
    return { item, valueLines };
  });
  const maxRows = Math.max(leftRows.length, rightRows.length);
  let actualSummaryHeight = 24 + 12; // título + línea + padding inicial
  for (let i = 0; i < maxRows; i++) {
    const leftH = leftRows[i] ? 12 + (leftRows[i].valueLines.length * 12) + 4 : 0;
    const rightH = rightRows[i] ? 12 + (rightRows[i].valueLines.length * 12) + 4 : 0;
    actualSummaryHeight += Math.max(leftH, rightH);
  }
  const summaryBoxHeight = actualSummaryHeight;
  ensureSpace(summaryBoxHeight + 8);
  
  // Cuadro destacado con bordes más visibles (tipo acta/banco)
  doc.setDrawColor(...COLORS.textMain);
  doc.setLineWidth(1.5);
  doc.setFillColor(...COLORS.bgSoft);
  doc.rect(margin, yPosition, contentWidth, summaryBoxHeight, 'FD');
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  setTextColor(COLORS.primaryDark);
  doc.text('Resumen ejecutivo', pageWidth / 2, yPosition + 20, { align: 'center' });
  
  // Línea bajo el título
  doc.setDrawColor(...COLORS.textMain);
  doc.setLineWidth(0.5);
  doc.line(margin + 14, yPosition + 26, pageWidth - margin - 14, yPosition + 26);
  
  let summaryY = yPosition + 36;
  
  // Dibujar fila por fila (ambas columnas en paralelo) para evitar solapamientos
  for (let i = 0; i < maxRows; i++) {
    const left = leftRows[i];
    const right = rightRows[i];
    const rowHeight = Math.max(
      left ? 12 + (left.valueLines.length * 12) + 4 : 0,
      right ? 12 + (right.valueLines.length * 12) + 4 : 0
    );
    
    if (left) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      setTextColor(COLORS.textMuted);
      doc.text(`${left.item.label}:`, margin + 14, summaryY);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      setTextColor(COLORS.textMain);
      left.valueLines.forEach((line: string, idx: number) => {
        doc.text(line, margin + 14, summaryY + 12 + (idx * 12));
      });
    }
    
    if (right) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      setTextColor(COLORS.textMuted);
      doc.text(`${right.item.label}:`, margin + colWidth + colSpacing + 14, summaryY);
      doc.setFont(right.item.monospace ? 'courier' : 'helvetica', 'normal');
      doc.setFontSize(10);
      setTextColor(COLORS.textMain);
      right.valueLines.forEach((line: string, idx: number) => {
        doc.text(line, margin + colWidth + colSpacing + 14, summaryY + 12 + (idx * 12));
      });
    }
    
    summaryY += rowHeight;
  }
  
  yPosition += summaryBoxHeight + 16;

  // ========================================
  // SECCIÓN 2: IDENTIFICACIÓN DE LAS PARTES
  // ========================================
  drawSectionTitle('Identificación de las partes');
  
  // Formato acta: dos columnas visuales (label alineado a la izquierda, valor a la derecha)
  const identificationData = [
    { label: 'Remitente', value: mailData.senderName || mailData.from || 'No especificado' },
    { label: 'Destinatario', value: mailData.recipientEmail || 'No especificado' },
    { label: 'Asunto', value: mailData.message?.subject || 'Sin asunto declarado' },
    { label: 'Fecha de envío', value: formatDate(mailData.delivery?.time) }
  ];
  
  // Calcular altura (padding inferior extra para que el último renglón no roce el borde)
  let idBoxHeight = 18;
  identificationData.forEach((item) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    const valueLines = doc.splitTextToSize(item.value, contentWidth * 0.65);
    idBoxHeight += 20 + (valueLines.length - 1) * 14;
  });
  idBoxHeight += 18;
  
  ensureSpace(idBoxHeight + 8);
  drawBox(margin, yPosition, contentWidth, idBoxHeight, false);
  
  let idY = yPosition + 20;
  const labelWidth = contentWidth * 0.30; // 30% para labels
  const valueX = margin + labelWidth + 12; // Espacio entre label y valor

  identificationData.forEach((item) => {
    // Label (izquierda) - nunca más de una idea por línea
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    setTextColor(COLORS.textMain);
    doc.text(`${item.label}:`, margin + 14, idY);
    
    // Valor (derecha)
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    setTextColor(COLORS.textMain);
    const valueLines = doc.splitTextToSize(item.value, contentWidth * 0.65);
    valueLines.forEach((line: string, idx: number) => {
      doc.text(line, valueX, idY + (idx * 14));
    });
    
    idY += 20 + (valueLines.length - 1) * 14;
  });

  yPosition += idBoxHeight + 14;

  // Información técnica de verificación - bloque técnico/pericial
  const contentHashStored = (mailData as any).polygonCertifications?.contentHash;
  const contentHashComputed = await computeContentHash(
    mailData.message?.subject || '',
    mailData.message?.html,
    mailData.message?.text
  );
  const contentHash = contentHashStored || contentHashComputed;

  if (mailData.tracking?.token || mailData.readerUrl || mailData.delivery?.info || contentHash) {
    drawSectionTitle('Datos técnicos de verificación', 2);

    const techData = [];
    if (mailData.tracking?.token) {
      techData.push({ label: 'Token de verificación', value: mailData.tracking.token, monospace: true });
    }
    if (mailData.delivery?.info) {
      techData.push({ label: 'Identificador de entrega', value: mailData.delivery.info, monospace: true });
    }
    if (mailData.readerUrl) {
      techData.push({ label: 'URL de acceso al lector certificado', value: mailData.readerUrl, monospace: true });
    }
    if (contentHash) {
      techData.push({
        label: 'Hash de integridad del contenido (SHA-256)',
        value: contentHash,
        monospace: true
      });
    }

    if (techData.length > 0) {
      // Calcular altura para bloque técnico (padding superior alineado con techY = yPosition + 20)
      let techHeight = 20;
      techData.forEach((item) => {
        doc.setFont('courier', 'normal');
        doc.setFontSize(9);
        const valueLines = doc.splitTextToSize(item.value || 'No disponible', contentWidth - 28);
        techHeight += 16 + (valueLines.length * 12) + 8;
      });
      techHeight += 16;
      
      ensureSpace(techHeight + 8);
      drawBox(margin, yPosition, contentWidth, techHeight, false);
      
      let techY = yPosition + 20;
      techData.forEach((item) => {
        // Label
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        setTextColor(COLORS.textMuted);
        doc.text(`${item.label}:`, margin + 14, techY);
        techY += 16;

        // Valor (monospace, tamaño más pequeño - aspecto técnico)
        doc.setFont('courier', 'normal');
        doc.setFontSize(9);
        setTextColor(COLORS.textMain);
        const valueLines = doc.splitTextToSize(item.value || 'No disponible', contentWidth - 28);
        valueLines.forEach((line: string) => {
          doc.text(line, margin + 14, techY);
          techY += 12;
        });
        techY += 8;
      });
      
      yPosition += techHeight + 12;
    }
  }

  // ========================================
  // SECCIÓN 2b: CERTIFICACIÓN BLOCKCHAIN (POLYGON)
  // ========================================
  const polygonCerts = mailData.polygonCertifications;
  const POLYGON_EXPLORER = 'https://polygonscan.com';
  const polygonEntries = polygonCerts
    ? [
        { label: 'Envío', txHash: polygonCerts.send },
        { label: 'Recepción', txHash: polygonCerts.receive },
        { label: 'Lectura', txHash: polygonCerts.read },
      ].filter((e) => e.txHash && typeof e.txHash === 'string')
    : [];

  if (polygonEntries.length > 0) {
    drawSectionTitle('Certificación en Blockchain (Polygon)', 2);

    const LINK_COLOR: [number, number, number] = COLORS.primaryDark;
    const introText =
      'Transacciones ancladas en Polygon Mainnet. Enlace clicable al explorador PolygonScan y URL completa para copiar y pegar.';

    const entryBlockHeight = (label: string, txHash: string) => {
      const url = `${POLYGON_EXPLORER}/tx/${txHash}`;
      const shortHash = `${txHash.slice(0, 10)}...${txHash.slice(-8)}`;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      const titleLines = doc.splitTextToSize(`${label} — hash ${shortHash}`, contentWidth - 28);
      doc.setFont('courier', 'normal');
      doc.setFontSize(8);
      const urlLines = doc.splitTextToSize(url, contentWidth - 28);
      // Título (var. líneas) + enlace + rótulo + URL (var. líneas) + separación
      return titleLines.length * 15 + 18 + 13 + urlLines.length * 12 + 12;
    };

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const introLines = doc.splitTextToSize(introText, contentWidth - 28);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    const footerText = 'PolygonScan (polygonscan.com) es el explorador público de la red Polygon.';
    const footerLines = doc.splitTextToSize(footerText, contentWidth - 28);

    let polygonHeight = 18 + introLines.length * 13 + 10;
    polygonEntries.forEach((entry) => {
      polygonHeight += entryBlockHeight(entry.label, entry.txHash as string);
    });
    polygonHeight += footerLines.length * 11 + 12;

    ensureSpace(polygonHeight + 8);
    drawBox(margin, yPosition, contentWidth, polygonHeight, false);

    let polygonY = yPosition + 18;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    setTextColor(COLORS.textMain);
    introLines.forEach((line: string) => {
      doc.text(line, margin + 14, polygonY);
      polygonY += 13;
    });
    polygonY += 8;

    polygonEntries.forEach((entry) => {
      const url = `${POLYGON_EXPLORER}/tx/${entry.txHash}`;
      const shortHash = `${entry.txHash!.slice(0, 10)}...${entry.txHash!.slice(-8)}`;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      setTextColor(COLORS.textMain);
      const titleLines = doc.splitTextToSize(`${entry.label} — hash ${shortHash}`, contentWidth - 28);
      titleLines.forEach((line: string) => {
        doc.text(line, margin + 14, polygonY);
        polygonY += 15;
      });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      setTextColor(LINK_COLOR);
      doc.textWithLink('Abrir esta transacción en PolygonScan', margin + 14, polygonY, { url });
      polygonY += 18;

      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8.5);
      setTextColor(COLORS.textMuted);
      doc.text('Si el enlace anterior no responde al clic, copie la URL siguiente:', margin + 14, polygonY);
      polygonY += 13;

      doc.setFont('courier', 'normal');
      doc.setFontSize(8.5);
      setTextColor(COLORS.textMain);
      const urlLines = doc.splitTextToSize(url, contentWidth - 28);
      urlLines.forEach((line: string) => {
        doc.text(line, margin + 14, polygonY);
        polygonY += 12;
      });
      polygonY += 12;
    });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    setTextColor(COLORS.textMuted);
    footerLines.forEach((line: string) => {
      doc.text(line, margin + 14, polygonY);
      polygonY += 11;
    });
    yPosition += polygonHeight + 14;
  }

  // ========================================
  // SECCIÓN 3: CONTENIDO DEL MENSAJE CERTIFICADO
  // ========================================
  // Priorizar message.content (contenido real) sobre html/text (template completo del email)
  const rawContent = (mailData.message as { content?: string })?.content
    || mailData.message?.html
    || mailData.message?.text
    || '';
  const cleanedContent = rawContent ? sanitizeHtml(typeof rawContent === 'string' ? rawContent : '') : '';
  if (cleanedContent) {
    drawSectionTitle('Contenido del mensaje certificado');
    
    const padding = 14;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const contentLines = doc.splitTextToSize(cleanedContent, contentWidth - padding * 2 - 8); // Margen interno adicional
    const contentHeight = contentLines.length * 14 + padding * 2 + 8;
    
    ensureSpace(contentHeight + 8);
    
    // Caja tipo cita con bordes visibles
    doc.setDrawColor(...COLORS.textMain);
    doc.setLineWidth(1); // Borde más visible
    drawBox(margin, yPosition, contentWidth, contentHeight, false);
    
    let msgY = yPosition + padding + 12;
    
    // Contenido del mensaje - estilo cita (con comillas visuales implícitas por el recuadro)
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    setTextColor(COLORS.textMain);
    contentLines.forEach((line: string) => {
      doc.text(line, margin + padding + 4, msgY);
      msgY += 14;
    });
    
    yPosition += contentHeight + 16;
  }

  // ========================================
  // SECCIÓN 4: DOCUMENTOS ADJUNTOS (SI CORRESPONDE)
  // ========================================
  if (attachments.length > 0) {
    drawSectionTitle('Documentos adjuntos certificados');
    // Tabla de adjuntos con mejor formato
    const attachmentRows = attachments.map((attachment, index) => {
      const att = attachment as MailAttachment & Record<string, unknown>;
      const fileName = attachmentDisplayName(att, index);
      const hash = att.hash || 'No disponible';
      return [String(index + 1), fileName, String(hash)];
    });

    drawTable(
      ['#', 'Nombre del archivo', 'Hash SHA-256 (integridad)'],
      attachmentRows,
      [
        contentWidth * 0.05, // #
        contentWidth * 0.4, // Nombre
        contentWidth * 0.55, // Hash
      ]
    );

    const LINK_COLOR: [number, number, number] = COLORS.primaryDark;
    const introAcceso =
      'Enlace estable a cada documento en Notificas (misma ruta que el visor del panel). Copie la URL o use el enlace si su lector de PDF lo permite. Debe iniciar sesión con una cuenta autorizada para ver el archivo.';

    const measureLinkBlockHeight = () => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      const introLines = doc.splitTextToSize(introAcceso, contentWidth - 28);
      let h = 18 + introLines.length * 12 + 10;
      attachments.forEach((raw, index) => {
        const att = raw as MailAttachment & Record<string, unknown>;
        const fileName = attachmentDisplayName(att, index);
        const attId = attachmentStableId(att, index, messageId);
        const url = stableDashboardAttachmentUrl(messageId, attId);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        const titleLines = doc.splitTextToSize(`${index + 1}. ${fileName}`, contentWidth - 28);
        doc.setFont('courier', 'normal');
        doc.setFontSize(8);
        const urlLines = doc.splitTextToSize(url, contentWidth - 28);
        h += titleLines.length * 14 + 16 + 12 + urlLines.length * 11 + 10;
      });
      return h + 8;
    };

    const accesoBoxH = measureLinkBlockHeight();
    ensureSpace(accesoBoxH + 8);
    drawBox(margin, yPosition, contentWidth, accesoBoxH, true);

    let ay = yPosition + 16;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    setTextColor(COLORS.textMain);
    const introLinesDraw = doc.splitTextToSize(introAcceso, contentWidth - 28);
    introLinesDraw.forEach((line: string) => {
      doc.text(line, margin + 14, ay);
      ay += 12;
    });
    ay += 8;

    attachments.forEach((raw, index) => {
      const att = raw as MailAttachment & Record<string, unknown>;
      const fileName = attachmentDisplayName(att, index);
      const attId = attachmentStableId(att, index, messageId);
      const url = stableDashboardAttachmentUrl(messageId, attId);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      setTextColor(COLORS.textMain);
      const titleLines = doc.splitTextToSize(`${index + 1}. ${fileName}`, contentWidth - 28);
      titleLines.forEach((line: string) => {
        doc.text(line, margin + 14, ay);
        ay += 14;
      });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      setTextColor(LINK_COLOR);
      doc.textWithLink(`Abrir «${fileName.length > 42 ? `${fileName.slice(0, 40)}…` : fileName}» en Notificas`, margin + 14, ay, {
        url,
      });
      ay += 16;

      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8.5);
      setTextColor(COLORS.textMuted);
      doc.text('URL (copiar si el enlace no responde al clic):', margin + 14, ay);
      ay += 12;

      doc.setFont('courier', 'normal');
      doc.setFontSize(8.5);
      setTextColor(COLORS.textMain);
      const urlLinesDraw = doc.splitTextToSize(url, contentWidth - 28);
      urlLinesDraw.forEach((line: string) => {
        doc.text(line, margin + 14, ay);
        ay += 11;
      });
      ay += 10;
    });

    yPosition += accesoBoxH + 12;
  }

  // ========================================
  // SECCIÓN 5: BITÁCORA DE EVENTOS AUDITABLES
  // ========================================
  drawSectionTitle('Bitácora de eventos auditables');
  if (!movements.length) {
    ensureSpace(24);
    drawBox(margin, yPosition, contentWidth, 24, false);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    setTextColor(COLORS.textMuted);
    doc.text('No se registraron eventos posteriores al envío del mensaje.', margin + 14, yPosition + 16);
    yPosition += 36;
  } else {
    // Tabla con 5 columnas: #, Evento, Fecha y hora, Detalle técnico, Navegador / Dispositivo
    const movementRows = movements.map((movement, index) => {
      // Unir navegador con versión en una sola línea
      let browserText = getMovementBrowserLabel(movement.browser);
      if (movement.browser) {
        if (movement.browserVersion && movement.browser !== 'Server' && movement.browser !== 'WhatsApp Cloud API') {
          browserText = `${movement.browser} ${movement.browserVersion}`;
        }
      }
      
      return [
        String(index + 1),
        getMovementLabel(movement.type),
        formatDate(movement.timestamp ?? movement.timestamp?.seconds),
        movement.description || 'Sin descripción',
        browserText
      ];
    });
    drawTable(
      ['#', 'Evento', 'Fecha y hora', 'Detalle técnico', 'Navegador / Dispositivo'],
      movementRows,
      [
        contentWidth * 0.05,
        contentWidth * 0.22,
        contentWidth * 0.18,
        contentWidth * 0.34,
        contentWidth * 0.21
      ]
    );

    // Nota informativa sobre la trazabilidad
    ensureSpace(16);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    setTextColor(COLORS.textMuted);
    doc.text(`Total de eventos registrados: ${movements.length}`, margin, yPosition);
    yPosition += 12;
  }

  // ========================================
  // SECCIÓN 6: DECLARACIÓN DE AUTENTICIDAD
  // ========================================
  drawSectionTitle('Declaración de autenticidad y valor probatorio');
  
  // Texto de declaración más formal y estructurado - más aire y líneas más cortas
  ensureSpace(12);
  const declarationText = `Por medio del presente, Notificas.com, en su carácter de Sistema de Notificaciones Fehacientes Digitales, certifica y deja constancia de que el mensaje identificado como "${messageId}" fue remitido, entregado y, en su caso, leído conforme a los registros técnicos que obran en sus bases de datos.`;
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  setTextColor(COLORS.textMain);
  // Líneas más cortas para mejor legibilidad
  const declarationLines = doc.splitTextToSize(declarationText, contentWidth - 20);
  declarationLines.forEach((line: string) => {
    doc.text(line, margin + 10, yPosition);
    yPosition += 16; // Más espacio entre líneas
  });
  
  yPosition += 12; // Más aire después del párrafo introductorio
  
  // Puntos de la declaración - mejor espaciado
  const statements = [
    'Todos los eventos asociados al mensaje (envío, entrega, apertura, lectura y accesos) han sido registrados con sellado criptográfico inmutable, preservando la integridad, trazabilidad y orden cronológico de los mismos.',
    'El contenido del mensaje (asunto y cuerpo) ha sido certificado mediante hash SHA-256 en la blockchain. Cualquier alteración del contenido produciría un hash diferente, permitiendo detectar modificaciones.',
    'Los documentos adjuntos incorporados, en caso de existir, han sido validados mediante hash SHA-256, garantizando su integridad e inalterabilidad.',
    'El presente certificado puede ser presentado ante autoridades administrativas, judiciales o cualquier organismo público o privado como medio de prueba del envío, contenido y recepción del mensaje certificado.',
    `La emisión de este certificado se efectuó el ${emissionDate.toLocaleDateString('es-ES', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    })} a las ${emissionDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })} horas.`
  ];
  
  statements.forEach((statement) => {
    ensureSpace(20);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    setTextColor(COLORS.textMain);
    doc.text('•', margin + 10, yPosition);
    // Líneas más cortas para mejor legibilidad
    const lines = doc.splitTextToSize(statement, contentWidth - 28);
    lines.forEach((line: string, lineIndex: number) => {
      doc.text(line, margin + 22, yPosition + (lineIndex * 15));
    });
    yPosition += Math.max(lines.length * 15, 20) + 6; // Más espacio entre items
  });
  
  yPosition += 12;

  // ========================================
  // SECCIÓN 7: CADENA DE INTEGRIDAD
  // ========================================
  // Líneas separadas para no cortar emails u otros valores a mitad de palabra
  const integrityParts = [
    { label: 'Identificador de mensaje', value: messageId },
    { label: 'Marca de tiempo de emisión (UTC)', value: emissionDate.toISOString() },
    { label: 'Remitente', value: mailData.senderName || 'N/A' },
    { label: 'Destinatario', value: mailData.recipientEmail || 'N/A' }
  ];
  const monoW = contentWidth - 24 - 4;
  const integrityLines: string[] = [];
  integrityParts.forEach(({ label, value }) => {
    const prefix = `${label}: `;
    doc.setFont('courier', 'normal');
    doc.setFontSize(9);
    const raw = value || 'N/A';
    const valueMax = Math.max(monoW - doc.getTextWidth(prefix), 56);
    const valueLines = doc.splitTextToSize(raw, valueMax);
    if (!valueLines.length) {
      integrityLines.push(`${prefix}${raw}`);
      return;
    }
    integrityLines.push(`${prefix}${valueLines[0]}`);
    for (let i = 1; i < valueLines.length; i++) {
      integrityLines.push(`  ${valueLines[i]}`);
    }
  });
  const lineStep = 13;
  const integrityBoxHeight = 18 + 14 + 14 + integrityLines.length * lineStep + 16;
  ensureSpace(integrityBoxHeight + 16);
  drawBox(margin, yPosition, contentWidth, integrityBoxHeight, false);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  setTextColor(COLORS.primaryDark);
  doc.text('Cadena de integridad del certificado', margin + 12, yPosition + 16);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  setTextColor(COLORS.textMuted);
  doc.text(
    'Componentes que vinculan este documento con el mensaje certificado:',
    margin + 12,
    yPosition + 32
  );

  doc.setFont('courier', 'normal');
  doc.setFontSize(9);
  setTextColor(COLORS.textMain);
  integrityLines.forEach((line: string, index: number) => {
    doc.text(line, margin + 12, yPosition + 48 + index * lineStep);
  });

  yPosition += integrityBoxHeight + 16;

  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page++) {
    doc.setPage(page);
    drawFooter(page, pageCount);
  }

  return new Promise((resolve) => {
    const pdfBlob = doc.output('blob');
    resolve(pdfBlob);
  });
}

export async function downloadCertificate(data: CertificateData): Promise<void> {
  const pdfBlob = await generateCertificatePDF(data);
  
  // Crear enlace de descarga
  const url = URL.createObjectURL(pdfBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `certificado-lectura-${data.messageId}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
