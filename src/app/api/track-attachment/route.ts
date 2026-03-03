import { NextRequest, NextResponse } from 'next/server';
import { doc, updateDoc, getDoc, arrayUnion } from 'firebase/firestore';
import { db } from '@/lib/firebase';

// Función para extraer información del navegador del User-Agent
function extractBrowserInfo(userAgent: string) {
  if (!userAgent) return 'Unknown';
  
  // Detectar navegadores comunes
  if (userAgent.includes('Chrome/')) {
    const match = userAgent.match(/Chrome\/(\d+\.\d+\.\d+\.\d+)/);
    return match ? `Chrome v${match[1]}` : 'Chrome';
  }
  if (userAgent.includes('Firefox/')) {
    const match = userAgent.match(/Firefox\/(\d+\.\d+)/);
    return match ? `Firefox v${match[1]}` : 'Firefox';
  }
  if (userAgent.includes('Safari/') && !userAgent.includes('Chrome')) {
    const match = userAgent.match(/Version\/(\d+\.\d+)/);
    return match ? `Safari v${match[1]}` : 'Safari';
  }
  if (userAgent.includes('Edge/')) {
    const match = userAgent.match(/Edge\/(\d+\.\d+\.\d+\.\d+)/);
    return match ? `Edge v${match[1]}` : 'Edge';
  }
  if (userAgent.includes('Opera/')) {
    const match = userAgent.match(/Opera\/(\d+\.\d+)/);
    return match ? `Opera v${match[1]}` : 'Opera';
  }
  
  return 'Unknown Browser';
}

// Función para generar UUID (versión simple)
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export async function POST(request: NextRequest) {
  try {
    const { messageId, attachmentId, fileName, action } = await request.json();

    if (!messageId || !attachmentId) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    console.log('📎 Tracking attachment click:', { messageId, attachmentId, fileName, action });

    // Obtener información del request
    const userAgent = request.headers.get('User-Agent') || 'Unknown';
    const clientIP = request.headers.get('X-Forwarded-For') || 
                     request.headers.get('X-Real-IP') || 
                     'Unknown';
    const forwardedIPs = request.headers.get('X-Forwarded-For') ? 
                        request.headers.get('X-Forwarded-For')!.split(',').map(ip => ip.trim()) : [];
    const realIP = request.headers.get('X-Real-IP') || 'Unknown';

    // Obtener el documento del mensaje
    const messageRef = doc(db, 'mail', messageId);
    const messageDoc = await getDoc(messageRef);

    if (!messageDoc.exists()) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    const messageData = messageDoc.data();

    // Crear movimiento para apertura de archivo adjunto
    const attachmentMovement = {
      id: generateUUID(),
      type: 'attachment_opened',
      description: `Apertura de archivo adjunto: ${fileName}`,
      timestamp: new Date().toISOString(),
      userAgent: userAgent,
      clientIP: clientIP,
      forwardedIPs: forwardedIPs,
      realIP: realIP,
      browser: extractBrowserInfo(userAgent),
      recipientEmail: messageData.recipientEmail || 'Unknown',
      attachmentId: attachmentId,
      fileName: fileName
    };

    // Obtener movimientos existentes
    const existingMovements = messageData.tracking?.movements || [];
    console.log('📊 Movimientos existentes:', existingMovements.length);

    // Actualizar el documento con el nuevo movimiento
    const currentAttachmentsOpened = messageData.tracking?.attachmentsOpened || 0;
    const newMovements = [...existingMovements, attachmentMovement];
    
    console.log('📊 Nuevos movimientos:', newMovements.length);
    console.log('📊 Nuevo movimiento:', attachmentMovement);
    
    // Usar arrayUnion para agregar el movimiento (más confiable)
    await updateDoc(messageRef, {
      'tracking.attachmentsOpened': currentAttachmentsOpened + 1,
      'tracking.lastAttachmentActivity': new Date(),
      'tracking.movements': arrayUnion(attachmentMovement)
    });

    console.log('✅ Attachment tracking movement added:', attachmentMovement);

    return NextResponse.json({ 
      success: true, 
      movementId: attachmentMovement.id 
    });

  } catch (error) {
    console.error('❌ Error tracking attachment:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}
