import { createHash } from 'crypto';
import jsPDF from 'jspdf';
import QRCode from 'qrcode';
import { computeContentHash } from './certification';
import { POLYGON_CERT_DISPLAY_ORDER, polygonCertLabel } from './polygon-cert-labels';
import { emailDeliveryLabel } from './email-delivery-label';
import {
  buildNotificationHumanSummary,
  deriveEmailEvidence,
  deriveWhatsAppEvidence,
  emailAppOpenDetected,
  emailChannelStatusLine,
  emailLegacyPixelDetected,
  emailReadConfirmedDetected,
  emailReaderOpenDetected,
  emailResendSignalDetected,
  firstCertificateMovement,
  formatEvidenceStatus,
  hasCertificateMovement,
  whatsAppChannelStatusLine,
  whatsAppLinkClickedDetected,
  whatsAppMetaReadDetected,
} from './certificate-email-evidence';
import { formatEvidenceTimestamp, formatEvidenceTimestampLocal, PDF_SCHEMA } from './pdf-evidence-format';
import { loadNotificasLogoJpeg, PDF_BRAND } from './pdf-brand';
import { publicCertificateVerifyUrl } from './public-verify-url';
import { campaignVerifyRef, formatVerifyRefLine } from './verify-hints';
import { stripRichTextToPlainText } from './rich-text';
import type { WhatsAppSentContent } from './whatsapp-evidence';

/** Texto intimado del certificado: el mismo plano que entra al hash, no el HTML del editor. */
export function certificatePlainBody(message?: {
  content?: string;
  contentText?: string;
  html?: string;
  text?: string;
} | null): string {
  const contentText = typeof message?.contentText === 'string' ? message.contentText.trim() : '';
  if (contentText) return contentText;
  const text = typeof message?.text === 'string' ? message.text.trim() : '';
  if (text && !/<\/?[a-z][\s\S]*>/i.test(text)) return text;
  const html = [message?.content, message?.html, message?.text].find(
    (value): value is string => typeof value === 'string' && value.trim().length > 0
  );
  return html ? stripRichTextToPlainText(html) : '';
}

interface MailMessageContent {
  html?: string;
  text?: string;
  subject?: string;
  content?: string; // Contenido real del mensaje (sin template de email)
  contentText?: string; // Texto plano del mensaje (usado para hash de integridad)
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
  whatsappDelivered?: boolean;
  whatsappRead?: boolean;
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
  recipientName?: string;
  recipientDni?: string;
  recipientCuit?: string;
  recipientPhone?: string;
  recipientLegajo?: string;
  campaignId?: string;
  campaignMessageId?: string;
  whatsappMessageId?: string;
  smtpMessageId?: string;
  smtpAccepted?: unknown;
  emailBounce?: unknown;
  evidenceSnapshotHash?: string;
  whatsappPhoneNumberId?: string;
  whatsappWabaId?: string;
  orgNombre?: string;
  orgCuit?: string;
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
    waDelivered?: string;
    waRead?: string;
    contentAccess?: string;
    contentAccessVia?: string;
    readConfirmed?: string;
    receive?: string;
    read?: string;
    certificate?: string;
    contentHash?: string;
    waBodyHash?: string;
    whatsapp?: string;
  };
  waRequestSnapshot?: unknown;
}

interface CertificateData {
  messageId: string;
  mailData: MailData;
  movements: any[];
  attachments: any[];
  /** Primera emisión. Si falta, el PDF cambia en cada descarga. */
  issuedAt?: Date;
  /** True si identidad y texto salen de evidence_snapshots (WORM). */
  evidenceSealed?: boolean;
  /** Ejemplar que reescribe un PDF cuya diagramación cortaba el cuerpo. Mismos hechos. */
  layoutCorrection?: boolean;
  whatsappSent?: WhatsAppSentContent | null;
  waDeliveredWebhookPreserved?: boolean;
  waReadWebhookPreserved?: boolean;
}

type MovementLike = {
  type?: string;
  timestamp?: unknown;
  description?: string;
  browser?: string;
  browserVersion?: string;
};

const MOVEMENT_TYPE_LABELS: Record<string, string> = {
  email_sent: 'Correo enviado',
  resend_sent: 'Correo aceptado para entrega',
  resend_delivered: 'Servidor del destinatario aceptó el correo',
  resend_delayed: 'Entrega de correo demorada',
  resend_bounced: 'Correo rebotó',
  resend_failed: 'El correo no se pudo enviar',
  resend_suppressed: 'Correo bloqueado',
  resend_complained: 'Correo marcado como spam',
  resend_opened_signal: 'Señal técnica de apertura del correo',
  resend_clicked_signal: 'Señal técnica de clic del correo',
  email_bounced: 'Correo rebotó (no llegó al buzón)',
  email_opened: 'Correo abierto (pixel)',
  reader_magic_open: 'Acceso al lector certificado',
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

const COLORS = PDF_BRAND;

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
    case 'Sistema (WhatsApp de Meta)':
      return 'WhatsApp';
    case 'Resend':
    case 'Resend webhook':
      return 'Servicio de correo';
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

function utcStamp(d: Date): string {
  return formatEvidenceTimestamp(d);
}

export async function generateCertificatePDF(data: CertificateData): Promise<Blob> {
  const {
    messageId,
    mailData,
    movements = [],
    attachments = [],
    evidenceSealed,
    whatsappSent,
    waDeliveredWebhookPreserved,
    waReadWebhookPreserved,
  } = data;

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
  const emissionDate =
    data.issuedAt instanceof Date && !Number.isNaN(data.issuedAt.getTime())
      ? data.issuedAt
      : new Date();

  const pdfMeta = doc as jsPDF & {
    setCreationDate?: (date: Date) => unknown;
    setFileId?: (id: string) => unknown;
  };
  pdfMeta.setCreationDate?.(emissionDate);
  pdfMeta.setFileId?.(
    createHash('sha256')
      .update(`notificas-cert|${messageId}|${emissionDate.toISOString()}`)
      .digest('hex')
      .slice(0, 32)
  );

  const formatDate = (value?: unknown) => {
    const formatted = formatEvidenceTimestamp(value);
    return formatted === '—' ? 'No disponible' : formatted;
  };

  const formatTableDate = (value?: unknown) => {
    const formatted = formatEvidenceTimestampLocal(value);
    return formatted === '—' ? 'No consta' : formatted;
  };

  const firstMovement = (types: string[]) => firstCertificateMovement(movements, types);
  const hasMovement = (types: string[]) => hasCertificateMovement(movements, types);
  const emailEvidence = deriveEmailEvidence(movements);
  const whatsappEvidence = deriveWhatsAppEvidence(movements);

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
  const FOOTER_RESERVE_PT = 90;
  const contentBottom = pageHeight - margin - FOOTER_RESERVE_PT;
  let yPosition = margin + 70;
  let headerPart: 'relato' | 'anexo' = 'relato';

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
    const applyFont = () => {
      const fontFamily = options.monospace ? 'courier' : 'helvetica';
      doc.setFont(fontFamily, options.bold ? 'bold' : options.italics ? 'italic' : 'normal');
      doc.setFontSize(fontSize);
      setTextColor(options.color || COLORS.textMain);
    };
    applyFont();

    // Para campos monospace (URLs, IDs), permitir corte en cualquier carácter
    const lines = options.monospace
      ? doc.splitTextToSize(text, contentWidth - 20)
      : doc.splitTextToSize(text, contentWidth);

    lines.forEach((line: string) => {
      if (yPosition + lineHeight > contentBottom) {
        doc.addPage();
        drawPageHeader(false, doc.getNumberOfPages());
        applyFont();
      }
      doc.text(line, margin + (options.monospace ? 10 : 0), yPosition);
      yPosition += lineHeight;
    });

    yPosition += 6;
  };

  /** Cuerpo intimado: un recuadro por página. Un solo box más alto que la hoja recorta el texto. */
  const writeQuotedContent = (text: string) => {
    const padding = 14;
    const lineHeight = 14;
    const applyBodyFont = () => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      setTextColor(COLORS.textMain);
    };
    applyBodyFont();
    const lines = doc.splitTextToSize(text, contentWidth - padding * 2 - 8);

    const addContentPage = () => {
      doc.addPage();
      drawPageHeader(false, doc.getNumberOfPages());
      applyBodyFont();
    };

    let i = 0;
    let continued = false;
    while (i < lines.length) {
      if (yPosition + padding + 12 + lineHeight > contentBottom) {
        addContentPage();
      }

      const boxTop = yPosition;
      const headerNote = continued ? 16 : 0;
      let firstBaseline = boxTop + padding + 12 + headerNote;
      const pageLines: string[] = [];
      while (i + pageLines.length < lines.length) {
        const baseline = firstBaseline + pageLines.length * lineHeight;
        if (baseline > contentBottom) break;
        pageLines.push(lines[i + pageLines.length]);
      }
      if (pageLines.length === 0) {
        addContentPage();
        continued = true;
        continue;
      }

      const boxHeight = pageLines.length * lineHeight + padding * 2 + 8 + headerNote;
      doc.setDrawColor(...COLORS.textMain);
      doc.setLineWidth(1);
      drawBox(margin, boxTop, contentWidth, boxHeight, false);

      let msgY = boxTop + padding + 12;
      if (continued) {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(8);
        setTextColor(COLORS.textMuted);
        doc.text('(continuación del texto intimado)', margin + padding + 4, msgY);
        msgY += 16;
      }

      applyBodyFont();
      pageLines.forEach((line: string) => {
        doc.text(line, margin + padding + 4, msgY);
        msgY += lineHeight;
      });

      yPosition = boxTop + boxHeight + 8;
      i += pageLines.length;
      if (i < lines.length) {
        addContentPage();
        continued = true;
      }
    }
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

    ensureSpace(headerHeight + 28);

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
    const logoBase64 = loadNotificasLogoJpeg();
    if (logoBase64) {
      const logoW = 36;
      const logoH = 36;
      doc.addImage(logoBase64, 'JPEG', pageWidth / 2 - logoW / 2, headerY, logoW, logoH);
    }
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(17);
    setTextColor(COLORS.primaryDark);
    doc.text('Notificas.com', pageWidth / 2, headerY + 42, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    setTextColor(COLORS.textMuted);
    doc.text(
      'Constancia técnica de notificación digital',
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
      doc.text(
        headerPart === 'anexo'
          ? 'Anexo técnico — para perito informático'
          : 'Certificado de lectura — constancia técnica',
        pageWidth / 2,
        yPosition,
        { align: 'center' }
      );

      yPosition += 16;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      setTextColor(COLORS.textMuted);
      const freezeNotice = doc.splitTextToSize(
        headerPart === 'anexo'
          ? 'Parte II — Comprobaciones criptográficas, snapshot inalterable y transacciones en Polygon. La inmutabilidad la aportan esas huellas y TX, no este PDF.'
          : 'Parte I — Relato para jueces, abogados y funcionarios. Anexo técnico al final. Se emite una sola vez.',
        contentWidth
      );
      doc.text(freezeNotice, pageWidth / 2, yPosition, { align: 'center' });
      yPosition += freezeNotice.length * 12;

      drawHorizontalRule(yPosition + 10);

      yPosition += 28;
    } else {
      const continuationTitleY = headerY + 78;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      setTextColor(COLORS.primaryDark);
      doc.text(
        headerPart === 'anexo' ? 'Anexo técnico' : 'Certificado de lectura',
        margin,
        continuationTitleY
      );
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

    const line1 = `Notificas.com · constancia técnica · Formato: ${PDF_SCHEMA.certificadoLectura} · se emite una sola vez`;
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

  const sealed = evidenceSealed === true || Boolean(mailData.evidenceSnapshotHash);
  const remitente =
    mailData.orgNombre || mailData.senderName || mailData.from || 'el remitente';
  const destinatario =
    mailData.recipientName || mailData.recipientEmail || 'el destinatario';
  const deliveryState = emailDeliveryLabel(
    mailData.delivery?.state,
    (mailData as { emailBounce?: unknown }).emailBounce
  );
  const attachmentsCount = attachments.length;
  const waDelivered =
    Boolean((mailData.tracking as { whatsappDelivered?: boolean } | undefined)?.whatsappDelivered) ||
    hasMovement(['whatsapp_delivered']);
  const waMetaRead =
    Boolean((mailData.tracking as { whatsappRead?: boolean } | undefined)?.whatsappRead) ||
    whatsAppMetaReadDetected(whatsappEvidence);
  const waLinkClicked = whatsAppLinkClickedDetected(whatsappEvidence);
  const hasWhatsApp = Boolean(
    mailData.recipientPhone ||
      mailData.whatsappMessageId ||
      hasMovement(['whatsapp_sent', 'whatsapp_delivered', 'whatsapp_read'])
  );
  const emailResendSignal = formatEvidenceStatus(emailResendSignalDetected(emailEvidence));
  const emailLegacyPixel = formatEvidenceStatus(emailLegacyPixelDetected(emailEvidence));
  const emailAppOpen = formatEvidenceStatus(emailAppOpenDetected(emailEvidence));
  const mailAccepted = deliveryState.toLowerCase().includes('aceptado');
  const emailHumanLine = emailChannelStatusLine(emailEvidence);
  const whatsappHumanLine = whatsAppChannelStatusLine(whatsappEvidence, waDelivered);

  const identificationData = [
    { label: 'Remitente', value: mailData.senderName || mailData.from || 'No especificado' },
    ...(mailData.orgNombre ? [{ label: 'Organización', value: mailData.orgNombre }] : []),
    ...(mailData.orgCuit ? [{ label: 'CUIT del remitente', value: mailData.orgCuit }] : []),
    { label: 'Destinatario', value: mailData.recipientName || mailData.recipientEmail || 'No especificado' },
    ...(mailData.recipientDni ? [{ label: 'DNI / identificación', value: String(mailData.recipientDni) }] : []),
    ...(mailData.recipientCuit ? [{ label: 'CUIT', value: String(mailData.recipientCuit) }] : []),
    { label: 'Email del destinatario', value: mailData.recipientEmail || 'No especificado' },
    ...(mailData.recipientPhone ? [{ label: 'Teléfono', value: String(mailData.recipientPhone) }] : []),
    ...(mailData.recipientLegajo ? [{ label: 'Legajo', value: String(mailData.recipientLegajo) }] : []),
    { label: 'Asunto', value: mailData.message?.subject || 'Sin asunto declarado' },
    { label: 'Fecha de envío', value: formatDate(mailData.delivery?.time) },
    ...(mailData.campaignId ? [{ label: 'ID de campaña', value: String(mailData.campaignId) }] : []),
    ...(mailData.campaignMessageId
      ? [{ label: 'ID de destinatario de campaña', value: String(mailData.campaignMessageId) }]
      : []),
    {
      label: 'Origen del texto y de las partes',
      value: sealed
        ? 'Copia inalterable tomada al enviar (snapshot)'
        : 'Registros del mensaje (sin snapshot sellado)',
    },
  ];

  const drawIdentificationSection = () => {
    drawSectionTitle('Identificación de las partes');
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
    const labelWidth = contentWidth * 0.3;
    const valueX = margin + labelWidth + 12;
    identificationData.forEach((item) => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      setTextColor(COLORS.textMain);
      doc.text(`${item.label}:`, margin + 14, idY);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      const valueLines = doc.splitTextToSize(item.value, contentWidth * 0.65);
      valueLines.forEach((line: string, idx: number) => {
        doc.text(line, valueX, idY + idx * 14);
      });
      idY += 20 + (valueLines.length - 1) * 14;
    });
    yPosition += idBoxHeight + 14;
  };

  const resultadoMetaLines = [
    `Emitido: ${formatEvidenceTimestampLocal(emissionDate)}`,
    `ID: ${messageId}`,
    `De: ${remitente}`,
    `Para: ${destinatario}`,
    `Asunto: ${mailData.message?.subject || 'Sin asunto declarado'}`,
    `Enviado: ${formatTableDate(mailData.delivery?.time)}`,
  ];
  const emailChannelLines = [
    `Aceptado por servidor de correo: ${deliveryState}`,
    `Apertura informada por proveedor: ${emailResendSignal}`,
    `Apertura por pixel: ${emailLegacyPixel}`,
    `Acceso al lector certificado: ${formatEvidenceStatus(emailReaderOpenDetected(emailEvidence))}`,
    `Lectura confirmada: ${formatEvidenceStatus(emailReadConfirmedDetected(emailEvidence))}`,
    ...(emailAppOpen === 'Sí' ? [`Apertura en aplicación web: ${emailAppOpen}`] : []),
    `Estado: ${emailHumanLine}`,
  ];
  const waChannelLines = hasWhatsApp
    ? [
        `Entregado al teléfono: ${formatEvidenceStatus(waDelivered)}`,
        `Leído en el chat: ${formatEvidenceStatus(waMetaRead)}`,
        `Acceso desde enlace del mensaje: ${formatEvidenceStatus(waLinkClicked)}`,
        `Estado: ${whatsappHumanLine}`,
      ]
    : [`Adjuntos certificados: ${attachmentsCount}`];
  const humanSummaryLine = buildNotificationHumanSummary({
    hasWhatsApp,
    waDelivered,
    email: emailEvidence,
    whatsapp: whatsappEvidence,
    mailAccepted,
  });

  const colWidth = (contentWidth - 28) / 2;
  const colSpacing = 14;
  const measureColumn = (lines: string[], width: number) =>
    lines.reduce((h, line) => {
      const wrapped = doc.splitTextToSize(line, width - 8);
      return h + 12 + wrapped.length * 12;
    }, 0);
  const metaHeight = resultadoMetaLines.length * 14 + 8;
  const resultadoBoxHeight =
    24 + 12 + metaHeight + 16 + Math.max(measureColumn(emailChannelLines, colWidth), measureColumn(waChannelLines, colWidth)) + 36 + 14;
  ensureSpace(resultadoBoxHeight + 8);
  doc.setDrawColor(...COLORS.textMain);
  doc.setLineWidth(1.5);
  doc.setFillColor(...COLORS.bgSoft);
  doc.rect(margin, yPosition, contentWidth, resultadoBoxHeight, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  setTextColor(COLORS.primaryDark);
  doc.text('Resultado de la notificación', pageWidth / 2, yPosition + 20, { align: 'center' });
  doc.setDrawColor(...COLORS.textMain);
  doc.setLineWidth(0.5);
  doc.line(margin + 14, yPosition + 26, pageWidth - margin - 14, yPosition + 26);
  let boxY = yPosition + 38;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  setTextColor(COLORS.textMain);
  resultadoMetaLines.forEach((line) => {
    doc.text(line, margin + 14, boxY);
    boxY += 14;
  });
  boxY += 8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  setTextColor(COLORS.primaryDark);
  doc.text('Correo', margin + 14, boxY);
  doc.text(hasWhatsApp ? 'WhatsApp' : 'Otros', margin + colWidth + colSpacing + 14, boxY);
  boxY += 14;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  const leftStartY = boxY;
  let leftY = leftStartY;
  emailChannelLines.forEach((line) => {
    doc.splitTextToSize(line, colWidth - 8).forEach((wrapped: string) => {
      doc.text(wrapped, margin + 14, leftY);
      leftY += 12;
    });
  });
  let rightY = leftStartY;
  waChannelLines.forEach((line) => {
    doc.splitTextToSize(line, colWidth - 8).forEach((wrapped: string) => {
      doc.text(wrapped, margin + colWidth + colSpacing + 14, rightY);
      rightY += 12;
    });
  });
  boxY = Math.max(leftY, rightY) + 10;
  doc.setDrawColor(...COLORS.border);
  doc.line(margin + 14, boxY, pageWidth - margin - 14, boxY);
  boxY += 14;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text('Lectura humana:', margin + 14, boxY);
  doc.setFont('helvetica', 'normal');
  doc.splitTextToSize(humanSummaryLine, contentWidth - 100).forEach((line: string, idx: number) => {
    doc.text(line, margin + 96, boxY + idx * 12);
  });
  yPosition += resultadoBoxHeight + 14;

  const simpleChronoRows: string[][] = [];
  const pushChrono = (movement: MovementLike | undefined, label: string) => {
    if (!movement?.timestamp) return;
    simpleChronoRows.push([formatTableDate(movement.timestamp), label]);
  };
  pushChrono(firstMovement(['email_sent', 'resend_sent']), 'Correo enviado y aceptado');
  pushChrono(firstMovement(['resend_delivered']), 'Servidor del destinatario aceptó el correo');
  pushChrono(emailEvidence.resendSignal, 'Apertura del correo informada por el proveedor');
  pushChrono(emailEvidence.legacyPixel, 'Apertura del correo por pixel');
  pushChrono(emailEvidence.readerOpen, 'Acceso al lector certificado');
  pushChrono(emailEvidence.readConfirmed, 'Lectura confirmada en el lector');
  pushChrono(firstMovement(['whatsapp_sent']), 'WhatsApp enviado');
  pushChrono(firstMovement(['whatsapp_delivered']), 'WhatsApp entregado al teléfono');
  pushChrono(whatsappEvidence.metaRead, 'WhatsApp leído en el chat');
  pushChrono(whatsappEvidence.linkClicked, 'Acceso desde enlace del mensaje de WhatsApp');
  if (simpleChronoRows.length > 0) {
    drawSectionTitle('Cronología (hechos congelados al emitir)', 2);
    drawTable(
      ['Hora local (ART)', 'Hecho'],
      simpleChronoRows,
      [contentWidth * 0.28, contentWidth * 0.72]
    );
  }
  writeTextBlock(
    sealed
      ? 'Notificas.com certifica una comunicación digital con copia inalterable al enviar. Este PDF se emite una sola vez: hechos posteriores no entran en esta copia.'
      : `Notificas.com certifica el mensaje "${messageId}" según sus registros. No hay snapshot sellado; el anexo técnico permite confrontar huellas y transacciones.`,
    9,
    12,
    { color: COLORS.textMuted }
  );

  const contentHashStored = (mailData as any).polygonCertifications?.contentHash;
  const contentHashComputed = await computeContentHash(mailData.message?.contentText || '');
  const contentHash = contentHashStored || contentHashComputed;
  const verifyUrl = publicCertificateVerifyUrl({
    id: messageId,
    campaignId: mailData.campaignId,
    kind: 'mail_certificate',
    hash: contentHash,
  });
  const verifyRef = campaignVerifyRef(
    'mail_certificate',
    mailData.campaignId || 'mail',
    messageId
  );

  const techData: Array<{ label: string; value: string; monospace?: boolean }> = [];
  if (mailData.tracking?.token) {
    techData.push({ label: 'Token de verificación', value: mailData.tracking.token, monospace: true });
  }
  if (mailData.delivery?.info) {
    techData.push({ label: 'Identificador SMTP (aceptación)', value: mailData.delivery.info, monospace: true });
  }
  const wamid = mailData.whatsappMessageId || (mailData as { tracking?: { whatsappMessageId?: string } }).tracking?.whatsappMessageId;
  if (wamid) {
    techData.push({ label: 'WhatsApp Message ID (wamid)', value: String(wamid), monospace: true });
    if (mailData.whatsappPhoneNumberId) {
      techData.push({ label: 'Phone Number ID (Meta)', value: String(mailData.whatsappPhoneNumberId), monospace: true });
    }
    if (mailData.whatsappWabaId) {
      techData.push({ label: 'WABA ID (Meta)', value: String(mailData.whatsappWabaId), monospace: true });
    }
    techData.push({
      label: 'Alcance de WhatsApp',
      value: whatsappSent?.renderedBody
        ? 'El globo de WhatsApp (template de Meta) se transcribe en la Parte I. El texto del correo/lector es el intimado en el hash de contenido, salvo que el envío sea solo WhatsApp.'
        : 'WhatsApp transportó un aviso (template de Meta) con enlace al lector. El texto intimado en el hash es el del correo y del lector, no el globo del chat, salvo que el globo conste más abajo.',
      monospace: false,
    });
  }
  const waBodyHash = (mailData as { polygonCertifications?: { waBodyHash?: string } }).polygonCertifications?.waBodyHash;
  if (waBodyHash) {
    techData.push({
      label: 'Hash del aviso WhatsApp (SHA-256 del pedido a Meta)',
      value: String(waBodyHash),
      monospace: true,
    });
  }
  if (mailData.evidenceSnapshotHash) {
    techData.push({ label: 'Hash del snapshot inmutable', value: mailData.evidenceSnapshotHash, monospace: true });
  }
  techData.push({
    label: 'Verificación pública',
    value: verifyUrl,
    monospace: true,
  });
  techData.push({
    label: 'Referencia de verificación',
    value: formatVerifyRefLine(verifyRef),
    monospace: true,
  });
  if (mailData.readerUrl) {
    techData.push({ label: 'URL de acceso al lector certificado', value: mailData.readerUrl, monospace: true });
  }
  if (contentHash) {
    techData.push({
      label: 'Hash de integridad del texto intimado (SHA-256)',
      value: contentHash,
      monospace: true
    });
    techData.push({
      label: 'Fórmula de reproducción del hash (para peritos)',
      value: 'SHA-256( UTF-8( trim(texto_plano_del_mensaje) ) ) — Texto del correo/lector. Implementación: crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto.trim())) — Web Crypto API estándar.',
      monospace: false
    });
  }

  try {
    const qr = await QRCode.toDataURL(verifyUrl, { margin: 0, width: 160 });
    ensureSpace(56);
    doc.addImage(qr, 'PNG', pageWidth - margin - 48, yPosition, 42, 42);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    setTextColor(COLORS.textMuted);
    doc.text('Escanee para validar si Notificas emitió este certificado.', margin, yPosition + 18);
    yPosition += 52;
  } catch {
    /* QR opcional */
  }

  // ========================================
  // SECCIÓN 2b: CERTIFICACIÓN BLOCKCHAIN (POLYGON)
  // ========================================
  const polygonCerts = mailData.polygonCertifications;
  const POLYGON_EXPLORER = 'https://polygonscan.com';
  const polygonEntries = polygonCerts
    ? POLYGON_CERT_DISPLAY_ORDER
        .map((key) => ({
          label: polygonCertLabel(key, polygonCerts.contentAccessVia),
          txHash: (polygonCerts as Record<string, string | undefined>)[key],
        }))
        .filter((e) => e.txHash && typeof e.txHash === 'string' && e.txHash.startsWith('0x'))
    : [];

  const drawPolygonSection = () => {
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
  };

  // ========================================
  // SECCIÓN 3: CONTENIDO DEL MENSAJE CERTIFICADO
  // ========================================
  const cleanedContent = certificatePlainBody(mailData.message);
  if (cleanedContent) {
    drawSectionTitle(hasWhatsApp ? 'Contenido enviado por correo (lector)' : 'Contenido del mensaje certificado');
    if (data.layoutCorrection) {
      writeTextBlock(
        'Este ejemplar corrige la diagramación de uno anterior: el cuerpo intimado no cabía en una sola página y quedaba cortado. La fecha de emisión, el snapshot y los hechos congelados no cambian.',
        9,
        12,
        { italics: true, color: COLORS.textMuted }
      );
    }
    writeQuotedContent(cleanedContent);
    yPosition += 8;
  }

  if (whatsappSent) {
    drawSectionTitle('Contenido enviado por WhatsApp');
    if (whatsappSent.templateBodyMissing && !whatsappSent.renderedBody) {
      writeTextBlock(
        'No se pudo lacrar el texto fijo de Meta en este envío. Se certifican el nombre del template, el idioma y las variables. El WhatsApp sí se envió.',
        9,
        12,
        { color: COLORS.textMuted }
      );
    } else if (!whatsappSent.renderedBody) {
      writeTextBlock(
        'No se almacena el texto fijo del template de Meta. Se transcriben las variables enviadas (ya sustituidas).',
        9,
        12,
        { color: COLORS.textMuted }
      );
    }
    if (whatsappSent.renderedHeader) {
      writeTextBlock(`Encabezado: ${whatsappSent.renderedHeader}`, 10, 13, { bold: true });
    }
    if (whatsappSent.renderedBody) {
      writeTextBlock(whatsappSent.renderedBody, 10, 14);
    }
    if (whatsappSent.renderedFooter) {
      writeTextBlock(whatsappSent.renderedFooter, 9, 12, { italics: true, color: COLORS.textMuted });
    }
    writeTextBlock(
      'Template, variables y URLs completas del pedido a Meta: ver anexo técnico.',
      8,
      11,
      { color: COLORS.textMuted }
    );
  } else if (hasWhatsApp) {
    drawSectionTitle('Contenido enviado por WhatsApp');
    writeTextBlock(
      'No hay pedido a Meta en el snapshot. No se reconstruye el globo desde datos vivos.',
      9,
      12,
      { color: COLORS.textMuted }
    );
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

  const drawBitacoraSection = () => {
    drawSectionTitle('Bitácora de eventos auditables', 2);
    if (!movements.length) {
      ensureSpace(24);
      drawBox(margin, yPosition, contentWidth, 24, false);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      setTextColor(COLORS.textMuted);
      doc.text('No se registraron eventos posteriores al envío del mensaje.', margin + 14, yPosition + 16);
      yPosition += 36;
      return;
    }
    const movementRows = movements.map((movement, index) => {
      let browserText = getMovementBrowserLabel(movement.browser);
      if (
        movement.browser &&
        movement.browserVersion &&
        movement.browser !== 'Server' &&
        movement.browser !== 'WhatsApp Cloud API'
      ) {
        browserText = `${movement.browser} ${movement.browserVersion}`;
      }
      const detail = movement.description || 'Sin descripción';
      const browserSuffix = browserText !== 'N/A' ? ` · ${browserText}` : '';
      return [
        String(index + 1),
        getMovementLabel(movement.type),
        formatTableDate(movement.timestamp ?? movement.timestamp?.seconds),
        `${detail}${browserSuffix}`,
      ];
    });
    drawTable(
      ['#', 'Evento', 'Fecha (ART)', 'Detalle'],
      movementRows,
      [contentWidth * 0.05, contentWidth * 0.24, contentWidth * 0.2, contentWidth * 0.51]
    );
    ensureSpace(16);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    setTextColor(COLORS.textMuted);
    doc.text(`Total de eventos registrados: ${movements.length}`, margin, yPosition);
    yPosition += 12;
  };

  const drawWhatsAppAnexoSection = () => {
    if (!whatsappSent) return;
    drawSectionTitle('WhatsApp — pedido a Meta', 2);
    writeTextBlock(
      `Template: ${whatsappSent.templateName} · ${whatsappSent.templateLang}` +
        (whatsappSent.templateHash ? ` · Template Hash: ${whatsappSent.templateHash}` : '') +
        (whatsappSent.templateId ? ` · ID ${whatsappSent.templateId}` : ''),
      9,
      12
    );
    if (whatsappSent.variables.length > 0) {
      drawTable(
        ['{{n}}', 'Campo', 'Valor enviado a Meta'],
        whatsappSent.variables.map((v) => [`{{${v.n}}}`, v.field || '—', v.value || '—']),
        [contentWidth * 0.14, contentWidth * 0.28, contentWidth * 0.58]
      );
    }
    for (const btn of whatsappSent.buttons) {
      const label = btn.text ? `Botón: ${btn.text}` : 'Botón URL';
      const dest = btn.url
        ? `Destino: ${btn.url}`
        : btn.urlParameter
          ? `Parámetro enviado a Meta: ${btn.urlParameter}`
          : null;
      writeTextBlock(dest ? `${label}. ${dest}` : label, 9, 12);
    }
  };

  drawIdentificationSection();

  drawSectionTitle('Términos usados', 2);
  const glossary = [
    'Aceptado (correo): el servidor de correo tomó el mensaje para entrega.',
    'Apertura informada por proveedor: el servicio de correo registró apertura del mensaje.',
    'Apertura por pixel: registro de apertura del correo en bandeja.',
    'Lector certificado: visor donde el destinatario lee el contenido y puede confirmar lectura.',
    'Entregado (WhatsApp): el mensaje llegó al teléfono del destinatario.',
    'Leído en el chat: el destinatario abrió el mensaje en WhatsApp (doble tilde).',
    'Acceso desde enlace: el destinatario pulsó el enlace dentro del mensaje de WhatsApp.',
  ];
  glossary.forEach((entry) => {
    writeTextBlock(`• ${entry}`, 9, 13);
  });
  writeTextBlock('— Fin de la Parte I — El anexo técnico continúa en las páginas siguientes.', 9, 12, {
    color: COLORS.textMuted,
    italics: true,
  });

  // ========================================
  // SECCIÓN 6: ALCANCE
  // ========================================
  drawSectionTitle('Alcance de este documento');
  const statements = [
    'Esta Parte I relata qué se pidió enviar, a qué destino técnico y qué informaron después los proveedores. No califica valor legal ni prueba por sí sola la identidad civil del receptor.',
    'Los eventos listados son los congelados al emitir este certificado. Hechos posteriores no aparecen en esta copia.',
    'Que el servidor de correo haya aceptado el mensaje no significa que haya llegado a la casilla. “Entregado” o “leído” de WhatsApp se consignan solo si Meta los informó.',
    'El contenido (asunto y cuerpo del correo/lector) se certifica con hash SHA-256. Los adjuntos, si existen, también. Cualquier alteración produce un hash distinto.',
    `Emisión: ${utcStamp(emissionDate)}. Las descargas posteriores entregan el mismo PDF.`,
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

  headerPart = 'anexo';
  doc.addPage();
  drawPageHeader(true, doc.getNumberOfPages());

  drawSectionTitle('Snapshot y recálculo');
  writeTextBlock(
    sealed
      ? 'El evidence_snapshot es un registro de escritura única: se sella al enviar y no se modifica. Conserva identidad de las partes, texto o pedido a Meta, hashes de adjuntos, WAMID y Message-ID SMTP si existen. Este certificado transcribe esa copia. El recálculo del perito (SHA-256 del texto de la Parte I) debe coincidir con el contentHash. El recálculo no sustituye al snapshot: lo confronta.'
      : 'No hay snapshot sellado de este envío. Las huellas y transacciones del anexo, si existen, se confrontan con el texto transcrito de los registros del mensaje.',
    9,
    13
  );

  if (techData.length > 0) {
    drawSectionTitle('Datos técnicos de verificación', 2);
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
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      setTextColor(COLORS.textMuted);
      doc.text(`${item.label}:`, margin + 14, techY);
      techY += 16;
      doc.setFont(item.monospace === false ? 'helvetica' : 'courier', 'normal');
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

  drawWhatsAppAnexoSection();
  drawBitacoraSection();

  drawPolygonSection();

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
