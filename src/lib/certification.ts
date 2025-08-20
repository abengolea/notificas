import { sendPolygonTransaction } from './blockchain';
import { db } from './firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

/**
 * Certifica la lectura de un mensaje en la blockchain
 * @param messageId - ID del mensaje leído
 * @param userId - ID del usuario que leyó
 * @returns Promise<string> - Hash de la transacción
 */
export async function certificarLectura(messageId: string, userId: string): Promise<string> {
  try {
    const timestamp = new Date().toISOString();
    const payload = `READ|${messageId}|${userId}|${timestamp}`;
    
    console.log('📖 Certificando lectura de mensaje:', { messageId, userId });
    
    // Enviar transacción a Polygon
    const txHash = await sendPolygonTransaction(payload);
    
    // Guardar en Firestore para trazabilidad
    await addDoc(collection(db, 'blockchain_movements'), {
      type: 'read',
      userId,
      messageId,
      timestamp: serverTimestamp(),
      txHash,
      payload,
      status: 'confirmed'
    });

    console.log('✅ Lectura certificada en Polygon:', txHash);
    return txHash;
  } catch (error) {
    console.error('❌ Error al certificar lectura:', error);
    throw error;
  }
}

/**
 * Certifica el envío de un mensaje en la blockchain
 * @param messageId - ID del mensaje enviado
 * @param fromUserId - ID del remitente
 * @param toEmail - Email del destinatario
 * @returns Promise<string> - Hash de la transacción
 */
export async function certificarEnvio(messageId: string, fromUserId: string, toEmail: string): Promise<string> {
  try {
    const timestamp = new Date().toISOString();
    const payload = `SEND|${messageId}|${fromUserId}|${toEmail}|${timestamp}`;
    
    console.log('📤 Certificando envío de mensaje:', { messageId, fromUserId, toEmail });
    
    // Enviar transacción a Polygon
    const txHash = await sendPolygonTransaction(payload);
    
    // Guardar en Firestore
    await addDoc(collection(db, 'blockchain_movements'), {
      type: 'send',
      userId: fromUserId,
      messageId,
      toEmail,
      timestamp: serverTimestamp(),
      txHash,
      payload,
      status: 'confirmed'
    });

    console.log('✅ Envío certificado en Polygon:', txHash);
    return txHash;
  } catch (error) {
    console.error('❌ Error al certificar envío:', error);
    throw error;
  }
}

/**
 * Certifica la recepción de un mensaje en la blockchain
 * @param messageId - ID del mensaje recibido
 * @param userId - ID del usuario que recibió
 * @returns Promise<string> - Hash de la transacción
 */
export async function certificarRecepcion(messageId: string, userId: string): Promise<string> {
  try {
    const timestamp = new Date().toISOString();
    const payload = `RECEIVE|${messageId}|${userId}|${timestamp}`;
    
    console.log('📨 Certificando recepción de mensaje:', { messageId, userId });
    
    // Enviar transacción a Polygon
    const txHash = await sendPolygonTransaction(payload);
    
    // Guardar en Firestore
    await addDoc(collection(db, 'blockchain_movements'), {
      type: 'receive',
      userId,
      messageId,
      timestamp: serverTimestamp(),
      txHash,
      payload,
      status: 'confirmed'
    });

    console.log('✅ Recepción certificada en Polygon:', txHash);
    return txHash;
  } catch (error) {
    console.error('❌ Error al certificar recepción:', error);
    throw error;
  }
}

/**
 * Certifica la creación de un usuario en la blockchain
 * @param userId - ID del usuario creado
 * @param email - Email del usuario
 * @returns Promise<string> - Hash de la transacción
 */
export async function certificarUsuario(userId: string, email: string): Promise<string> {
  try {
    const timestamp = new Date().toISOString();
    const payload = `USER_CREATED|${userId}|${email}|${timestamp}`;
    
    console.log('👤 Certificando creación de usuario:', { userId, email });
    
    // Enviar transacción a Polygon
    const txHash = await sendPolygonTransaction(payload);
    
    // Guardar en Firestore
    await addDoc(collection(db, 'blockchain_movements'), {
      type: 'user_created',
      userId,
      email,
      timestamp: serverTimestamp(),
      txHash,
      payload,
      status: 'confirmed'
    });

    console.log('✅ Usuario certificado en Polygon:', txHash);
    return txHash;
  } catch (error) {
    console.error('❌ Error al certificar usuario:', error);
    throw error;
  }
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
  
  // Instrucciones de verificación
  doc.setFontSize(12);
  doc.setTextColor(100, 116, 139);
  doc.text('Para verificar la autenticidad de este documento:', 20, (doc as any).lastAutoTable.finalY + 45);
  doc.text('1. Ve a: https://notificas.com/verify', 20, (doc as any).lastAutoTable.finalY + 55);
  doc.text('2. Sube este PDF o ingresa el hash', 20, (doc as any).lastAutoTable.finalY + 65);
  doc.text('3. Confirma que fue emitido por Notificas.com', 20, (doc as any).lastAutoTable.finalY + 75);
  
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