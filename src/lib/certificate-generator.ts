import jsPDF from 'jspdf';

interface MailMessageContent {
  html?: string;
  text?: string;
  subject?: string;
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
}

interface CertificateData {
  messageId: string;
  mailData: MailData;
  movements: any[];
  attachments: any[];
}

const MOVEMENT_TYPE_LABELS: Record<string, string> = {
  email_sent: 'Correo enviado',
  email_opened: 'Correo abierto',
  message_received: 'Mensaje recibido',
  read_confirmed: 'Lectura confirmada',
  link_clicked: 'Acceso a enlace',
  attachment_downloaded: 'Descarga de adjunto',
  document_viewed: 'Documento visualizado',
  fallback_access: 'Ingreso por enlace alternativo'
};

// Colores basados en la plantilla HTML - ajustá estos según tu marca Notificas
const COLORS = {
  primary: [31, 111, 235] as [number, number, number], // #1f6feb - color principal botones
  primaryDark: [21, 62, 117] as [number, number, number], // #153e75 - variante oscura
  border: [229, 231, 235] as [number, number, number], // #e5e7eb - gris bordes
  bgSoft: [249, 250, 251] as [number, number, number], // #f9fafb - gris muy claro fondos
  textMain: [17, 24, 39] as [number, number, number], // #111827 - gris muy oscuro texto
  textMuted: [107, 114, 128] as [number, number, number], // #6b7280 - gris texto secundario
  success: [34, 197, 94] as [number, number, number], // #22c55e - verde éxito
  successBg: [220, 252, 231] as [number, number, number] // #dcfce7 - fondo verde claro
};

function getMovementLabel(type?: string) {
  if (!type) return 'Movimiento registrado';
  const normalized = type.toLowerCase();
  return MOVEMENT_TYPE_LABELS[normalized] || type.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

export async function generateCertificatePDF(data: CertificateData): Promise<Blob> {
  const { messageId, mailData, movements = [], attachments = [] } = data;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4'
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
    doc.setLineWidth(0.5);
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
  let yPosition = margin + 70;

  const ensureSpace = (space: number) => {
    if (yPosition + space > pageHeight - margin - 40) {
      doc.addPage();
      drawPageHeader(false, doc.getNumberOfPages());
      yPosition = margin + 56;
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
    ensureSpace(level === 1 ? 24 : 18);
    if (level === 1) {
      // Título principal de sección - más prominente
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      setTextColor(COLORS.primaryDark);
      doc.text(title.toUpperCase(), margin, yPosition);
      yPosition += 4;
      drawHorizontalRule(yPosition);
      yPosition += 12;
    } else {
      // Subtítulo - menos prominente
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      setTextColor(COLORS.textMain);
      doc.text(title, margin, yPosition);
      yPosition += 14;
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

  const drawTable = (headers: string[], rows: string[][], columnWidths: number[]) => {
    if (!rows.length) return;

    const headerHeight = 18;
    const rowPadding = 6;
    
    // Calcular altura total aproximada de la tabla para evitar cortes
    const estimatedHeight = headerHeight + rows.length * 24 + 12;
    ensureSpace(estimatedHeight + 20);

    // Table header background - más oscuro para mejor contraste en B&N
    doc.setFillColor(240, 240, 240); // Gris más oscuro para impresión
    doc.rect(margin, yPosition - 6, contentWidth, headerHeight + 6, 'F');

    // Draw header border - más visible
    doc.setDrawColor(...COLORS.textMain); // Bordes más oscuros
    doc.setLineWidth(0.75); // Línea más gruesa
    doc.rect(margin, yPosition - 6, contentWidth, headerHeight + 6, 'S');

    // Header text - Title Case, no todo en mayúsculas
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    setTextColor(COLORS.textMuted);

    let xCursor = margin + 4;
    headers.forEach((header, index) => {
      // Title Case para headers más legible
      const headerText = header.split(' ').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
      ).join(' ');
      doc.text(headerText.toUpperCase(), xCursor, yPosition + 4);
      xCursor += columnWidths[index];
    });

    yPosition += headerHeight + 4;

    // Table rows
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    setTextColor(COLORS.textMain);

    rows.forEach((row, rowIndex) => {
      const linesPerCell = row.map((cell, index) =>
        doc.splitTextToSize(cell || 'N/A', columnWidths[index] - 8)
      );
      const rowHeight = Math.max(...linesPerCell.map((lines) => lines.length)) * 14 + rowPadding * 2;
      ensureSpace(rowHeight);

      // Row background (alternate)
      if (rowIndex % 2 === 0) {
        doc.setFillColor(255, 255, 255);
      } else {
        doc.setFillColor(...COLORS.bgSoft);
      }
      doc.rect(margin, yPosition - 2, contentWidth, rowHeight, 'F');

      // Row border
      doc.setDrawColor(...COLORS.border);
      doc.rect(margin, yPosition - 2, contentWidth, rowHeight, 'S');

      // Cell content
      let x = margin + 4;
      linesPerCell.forEach((lines: string[], columnIndex) => {
        let y = yPosition + 10;
        
        lines.forEach((line: string) => {
          doc.text(line, x, y);
          y += 14; // Interlineado 1.4
        });
        
        // Cell border
        if (columnIndex < headers.length - 1) {
          doc.setDrawColor(...COLORS.border);
          doc.line(x + columnWidths[columnIndex] - 4, yPosition - 2, x + columnWidths[columnIndex] - 4, yPosition + rowHeight - 2);
        }
        
        x += columnWidths[columnIndex];
      });

      yPosition += rowHeight;
    });

    yPosition += 10;
  };

  const drawPageHeader = (isFirstPage: boolean, pageNumber: number) => {
    // Encabezado institucional - bloque único tipo acta/banco/AFIP
    const headerY = margin;
    
    // Título principal - más prominente
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    setTextColor(COLORS.textMain);
    doc.text('NOTIFICAS.COM', pageWidth / 2, headerY + 12, { align: 'center' });
    
    // Subtítulo
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    setTextColor(COLORS.textMuted);
    doc.text('Sistema de Notificaciones Fehacientes Digitales', pageWidth / 2, headerY + 26, { align: 'center' });
    
    // Línea separadora
    drawHorizontalRule(headerY + 36);
    
    if (isFirstPage) {
      yPosition = headerY + 48;
      
      // Título del certificado
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      setTextColor(COLORS.primaryDark);
      doc.text('CERTIFICADO OFICIAL DE LECTURA', pageWidth / 2, yPosition, { align: 'center' });
      
      // Segunda línea separadora
      drawHorizontalRule(yPosition + 10);
      
      yPosition += 26;
    } else {
      // Continuation header
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      setTextColor(COLORS.primaryDark);
      doc.text('CERTIFICADO OFICIAL DE LECTURA', margin, headerY + 48);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      setTextColor(COLORS.textMuted);
      doc.text(`Página ${pageNumber}`, pageWidth - margin, headerY + 48, { align: 'right' });
      yPosition = headerY + 64;
    }
  };

  const drawFooter = (pageNumber: number, pageCount: number) => {
    const footerY = pageHeight - margin - 16;
    
    // Footer border
    drawHorizontalRule(footerY - 14);

    // Pie de página fijo - formato judicial
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    setTextColor(COLORS.textMuted);
    
    const footerText = `Notificas.com – Sistema de Notificaciones Fehacientes Digitales | ID de Certificado: ${messageId} | Página ${pageNumber} de ${pageCount}`;
    doc.text(footerText, pageWidth / 2, footerY, { align: 'center' });
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
  
  // Calcular altura columna izquierda
  let leftHeight = 32; // Título + padding inicial
  summaryLeft.forEach((item) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const valueLines = doc.splitTextToSize(item.value || 'No disponible', colWidth - 20);
    leftHeight += 12 + (valueLines.length * 12) + 4; // label + value + spacing
  });
  
  // Calcular altura columna derecha (independiente)
  let rightHeight = 32; // Título + padding inicial
  summaryRight.forEach((item) => {
    doc.setFont('courier', 'normal');
    doc.setFontSize(10);
    const valueLines = doc.splitTextToSize(item.value || 'No disponible', colWidth - 20);
    rightHeight += 12 + (valueLines.length * 12) + 4;
  });
  
  // Usar la altura mayor de las dos columnas
  const summaryBoxHeight = Math.max(leftHeight, rightHeight) + 24;
  ensureSpace(summaryBoxHeight + 8);
  
  // Cuadro destacado con bordes más visibles (tipo acta/banco)
  doc.setDrawColor(...COLORS.textMain); // Bordes más oscuros para impresión B&N
  doc.setLineWidth(1.5); // Línea más gruesa para destacar
  doc.setFillColor(...COLORS.bgSoft); // Fondo sutil
  doc.rect(margin, yPosition, contentWidth, summaryBoxHeight, 'FD'); // Dibujar con fondo
  
  // Título del resumen - centrado
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  setTextColor(COLORS.primaryDark);
  doc.text('RESUMEN EJECUTIVO', pageWidth / 2, yPosition + 20, { align: 'center' });
  
  // Línea bajo el título
  doc.setDrawColor(...COLORS.textMain);
  doc.setLineWidth(0.5);
  doc.line(margin + 14, yPosition + 26, pageWidth - margin - 14, yPosition + 26);
  
  let summaryY = yPosition + 36;
  
  // Columna izquierda
  summaryLeft.forEach((item) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    setTextColor(COLORS.textMuted);
    doc.text(`${item.label}:`, margin + 14, summaryY);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    setTextColor(COLORS.textMain);
    const valueLines = doc.splitTextToSize(item.value || 'No disponible', colWidth - 20);
    valueLines.forEach((line: string, idx: number) => {
      doc.text(line, margin + 14, summaryY + 12 + (idx * 12));
    });
    summaryY += 12 + (valueLines.length * 12) + 4;
  });
  
  // Columna derecha
  summaryY = yPosition + 36;
  summaryRight.forEach((item) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    setTextColor(COLORS.textMuted);
    doc.text(`${item.label}:`, margin + colWidth + colSpacing + 14, summaryY);
    
    doc.setFont(item.monospace ? 'courier' : 'helvetica', 'normal');
    doc.setFontSize(10);
    setTextColor(COLORS.textMain);
    const valueLines = doc.splitTextToSize(item.value || 'No disponible', colWidth - 20);
    valueLines.forEach((line: string, idx: number) => {
      doc.text(line, margin + colWidth + colSpacing + 14, summaryY + 12 + (idx * 12));
    });
    summaryY += 12 + (valueLines.length * 12) + 4;
  });
  
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
  
  // Calcular altura
  let idBoxHeight = 14;
  identificationData.forEach((item) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    const valueLines = doc.splitTextToSize(item.value, contentWidth * 0.65);
    idBoxHeight += 18 + (valueLines.length - 1) * 14;
  });
  idBoxHeight += 14;
  
  ensureSpace(idBoxHeight + 8);
  drawBox(margin, yPosition, contentWidth, idBoxHeight, false);
  
  let idY = yPosition + 18;
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
    
    idY += 18 + (valueLines.length - 1) * 14;
  });
  
  yPosition += idBoxHeight + 12;

  // Información técnica de verificación - bloque técnico/pericial
  if (mailData.tracking?.token || mailData.readerUrl || mailData.delivery?.info) {
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
    
    if (techData.length > 0) {
      // Calcular altura para bloque técnico
      let techHeight = 14;
      techData.forEach((item) => {
        doc.setFont('courier', 'normal');
        doc.setFontSize(9);
        const valueLines = doc.splitTextToSize(item.value || 'No disponible', contentWidth - 28);
        techHeight += 14 + (valueLines.length * 11) + 6;
      });
      techHeight += 14;
      
      ensureSpace(techHeight + 8);
      drawBox(margin, yPosition, contentWidth, techHeight, false);
      
      let techY = yPosition + 18;
      techData.forEach((item) => {
        // Label
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        setTextColor(COLORS.textMuted);
        doc.text(`${item.label}:`, margin + 14, techY);
        techY += 14;
        
        // Valor (monospace, tamaño más pequeño - aspecto técnico)
        doc.setFont('courier', 'normal');
        doc.setFontSize(9);
        setTextColor(COLORS.textMain);
        const valueLines = doc.splitTextToSize(item.value || 'No disponible', contentWidth - 28);
        valueLines.forEach((line: string) => {
          doc.text(line, margin + 14, techY);
          techY += 11;
        });
        techY += 6;
      });
      
      yPosition += techHeight + 12;
    }
  }

  // ========================================
  // SECCIÓN 3: CONTENIDO DEL MENSAJE CERTIFICADO
  // ========================================
  const cleanedContent = sanitizeHtml(mailData.message?.html || mailData.message?.text);
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
      const fileName = attachment.fileName || 'Documento sin nombre';
      const hash = attachment.hash || 'No disponible';
      return [
        String(index + 1),
        fileName,
        hash
      ];
    });
    
    drawTable(
      ['#', 'Nombre del archivo', 'Hash SHA-256 (integridad)'],
      attachmentRows,
      [
        contentWidth * 0.05,  // #
        contentWidth * 0.40,  // Nombre
        contentWidth * 0.55   // Hash
      ]
    );
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
      let browserText = 'N/A';
      if (movement.browser && movement.browser !== 'Server') {
        browserText = movement.browser;
        // Si tiene versión separada, unirla
        if (movement.browserVersion) {
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
        contentWidth * 0.05,  // #
        contentWidth * 0.15,  // Evento
        contentWidth * 0.18,  // Fecha y hora
        contentWidth * 0.40,  // Detalle técnico
        contentWidth * 0.22   // Navegador / Dispositivo
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
  ensureSpace(40);
  const integrityBoxHeight = 45;
  drawBox(margin, yPosition, contentWidth, integrityBoxHeight, false);
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  setTextColor(COLORS.primaryDark);
  doc.text('CADENA DE INTEGRIDAD DEL CERTIFICADO', margin + 12, yPosition + 16);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  setTextColor(COLORS.textMuted);
  doc.text('Este identificador único garantiza la autenticidad e integridad del presente documento:', margin + 12, yPosition + 28);
  
  doc.setFont('courier', 'normal');
  doc.setFontSize(9);
  setTextColor(COLORS.textMain);
  const integrityString = `${messageId}-${emissionDate.toISOString()}-${mailData.senderName || 'N/A'}-${mailData.recipientEmail || 'N/A'}`;
  const integrityLines = doc.splitTextToSize(integrityString, contentWidth - 24);
  integrityLines.forEach((line: string, index: number) => {
    doc.text(line, margin + 12, yPosition + 38 + (index * 11));
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
