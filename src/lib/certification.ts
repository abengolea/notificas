import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

/**
 * Normaliza el contenido del mensaje para calcular un hash consistente.
 * Usa la misma lógica que el certificado PDF (sin HTML, solo texto).
 */
function normalizeContentForHash(html?: string, text?: string): string {
  const raw = html || text || '';
  return raw
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Calcula el hash SHA-256 del contenido del mensaje (asunto + cuerpo).
 * Usa Web Crypto API (compatible con Node y navegador).
 * Vincula criptográficamente el contenido con la certificación en blockchain.
 */
export async function computeContentHash(
  subject: string,
  html?: string,
  text?: string
): Promise<string> {
  const content = normalizeContentForHash(html, text);
  const normalized = `${subject || ''}|${content}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(normalized);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export interface CertificationData {
  messageId: string;
  senderName: string;
  recipientEmail: string;
  subject: string;
  content: string;
  sentAt: Date;
  deliveryState: string;
  tracking: {
    opened: boolean;
    openedAt?: Date;
    openCount: number;
    clickCount: number;
    readConfirmed: boolean;
    readConfirmedAt?: Date;
  };
  blockchainHash: string;
  /** Hash SHA-256 del contenido (asunto + cuerpo) certificado en blockchain. Vincula el contenido con la certificación. */
  contentHash?: string;
}

export async function generateCertificationPDF(data: CertificationData): Promise<{ pdf: Blob; hash: string }> {
  // Crear PDF
  const doc = new jsPDF();
  
  // Configurar fuente para español
  doc.setFont('helvetica');
  
  // Título principal
  doc.setFontSize(20);
  doc.setTextColor(13, 148, 136); // Color teal de Notificas
  doc.text('CONSTANCIA DE NOTIFICACIÓN DIGITAL', 105, 20, { align: 'center' });
  
  // Logo/Header
  doc.setFontSize(12);
  doc.setTextColor(100, 116, 139);
  doc.text('Notificas.com - Sistema de Notificaciones Certificadas', 105, 30, { align: 'center' });
  
  // Línea separadora
  doc.setDrawColor(226, 232, 240);
  doc.line(20, 35, 190, 35);
  
  // Información del mensaje
  doc.setFontSize(14);
  doc.setTextColor(30, 41, 59);
  doc.text('Detalles del Mensaje:', 20, 50);
  
  // Tabla de detalles
  const details = [
    ['ID del Mensaje:', data.messageId],
    ['Remitente:', data.senderName],
    ['Destinatario:', data.recipientEmail],
    ['Asunto:', data.subject],
    ['Fecha de Envío:', data.sentAt.toLocaleString('es-ES')],
    ['Estado de Entrega:', data.deliveryState]
  ];
  
  (doc as any).autoTable({
    startY: 55,
    head: [['Campo', 'Valor']],
    body: details,
    theme: 'grid',
    headStyles: { fillColor: [13, 148, 136] },
    styles: { fontSize: 10 }
  });
  
  // Contenido del mensaje
  doc.setFontSize(14);
  doc.setTextColor(30, 41, 59);
  doc.text('Contenido del Mensaje:', 20, (doc as any).lastAutoTable.finalY + 20);
  
  // Dividir contenido en líneas
  const contentLines = doc.splitTextToSize(data.content, 170);
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.text(contentLines, 20, (doc as any).lastAutoTable.finalY + 30);
  
  // Métricas de tracking
  doc.setFontSize(14);
  doc.setTextColor(30, 41, 59);
  doc.text('Métricas de Tracking:', 20, (doc as any).lastAutoTable.finalY + 50);
  
  const trackingDetails = [
    ['Abierto:', data.tracking.opened ? 'SÍ' : 'NO'],
    ['Veces Abierto:', data.tracking.openCount.toString()],
    ['Clicks:', data.tracking.clickCount.toString()],
    ['Lectura Confirmada:', data.tracking.readConfirmed ? 'SÍ' : 'NO']
  ];
  
  if (data.tracking.openedAt) {
    trackingDetails.push(['Abierto el:', data.tracking.openedAt.toLocaleString('es-ES')]);
  }
  
  if (data.tracking.readConfirmedAt) {
    trackingDetails.push(['Confirmado el:', data.tracking.readConfirmedAt.toLocaleString('es-ES')]);
  }
  
  (doc as any).autoTable({
    startY: (doc as any).lastAutoTable.finalY + 55,
    head: [['Métrica', 'Valor']],
    body: trackingDetails,
    theme: 'grid',
    headStyles: { fillColor: [13, 148, 136] },
    styles: { fontSize: 10 }
  });
  
  // Información de certificación
  doc.setFontSize(14);
  doc.setTextColor(30, 41, 59);
  doc.text('Certificación Blockchain:', 20, (doc as any).lastAutoTable.finalY + 20);
  
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.text(`Hash de Verificación: ${data.blockchainHash}`, 20, (doc as any).lastAutoTable.finalY + 30);
  const certBaseY = (doc as any).lastAutoTable.finalY;
  if (data.contentHash) {
    doc.text(`Hash de Integridad del Contenido: ${data.contentHash}`, 20, certBaseY + 42);
  }

  // Instrucciones de verificación
  const instructionsY = data.contentHash ? 60 : 45;
  doc.setFontSize(12);
  doc.setTextColor(100, 116, 139);
  doc.text('Para verificar la autenticidad de este documento:', 20, certBaseY + instructionsY);
  doc.text('1. Ve a: https://notificas.com/verify', 20, certBaseY + instructionsY + 10);
  doc.text('2. Sube este PDF o ingresa el hash', 20, certBaseY + instructionsY + 20);
  doc.text('3. Confirma que fue emitido por Notificas.com', 20, certBaseY + instructionsY + 30);
  
  // Pie de página
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text('Documento generado automáticamente por Notificas.com', 105, 280, { align: 'center' });
  doc.text('Este documento es una constancia oficial certificada en la red Blockchain', 105, 285, { align: 'center' });
  
  // Generar PDF como Blob
  const pdfBlob = doc.output('blob');
  
  // Generar hash del contenido
  const hash = await generateHash(pdfBlob);
  
  return { pdf: pdfBlob, hash };
}

async function generateHash(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

export function downloadPDF(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}