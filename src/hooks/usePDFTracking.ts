import { useState, useEffect, useCallback } from 'react';
import { doc, updateDoc, getDoc, increment, arrayUnion } from 'firebase/firestore';
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

export interface PDFTrackingData {
  opened: boolean;
  openedAt: Date;
  duration: number;
  scrollDepth: number;
  deviceInfo: {
    userAgent: string;
    screenResolution: string;
    timezone: string;
    language: string;
  };
  ipAddress?: string;
  signatureStatus: 'pending' | 'signed' | 'declined';
  signatureTimestamp?: Date;
  lastActivity: Date;
  clickTimestamp?: Date; // Nuevo: timestamp del clic
  clickCount?: number; // Nuevo: contador de clics
}

export interface AttachmentTracking {
  id: string;
  name: string;
  url: string;
  size: number;
  type: string;
  uploadedAt: Date;
  tracking: PDFTrackingData;
}

export function usePDFTracking(messageId: string, attachmentId: string) {
  console.log('🔧 usePDFTracking hook inicializado:', { messageId, attachmentId });
  
  const [isTracking, setIsTracking] = useState(false);
  const [trackingData, setTrackingData] = useState<PDFTrackingData | null>(null);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [lastScrollPosition, setLastScrollPosition] = useState(0);

  // Inicializar tracking cuando se abre el PDF
  const startTracking = useCallback(async () => {
    console.log('🎯 startTracking llamado:', { messageId, attachmentId, isTracking });
    
    if (isTracking) {
      console.log('⚠️ Ya está tracking, ignorando...');
      return;
    }
    
    console.log('✅ Iniciando tracking...');
    setIsTracking(true);
    const now = new Date();
    setStartTime(now);
    
    // Obtener información del dispositivo
    const deviceInfo = {
      userAgent: navigator.userAgent,
      screenResolution: `${screen.width}x${screen.height}`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      language: navigator.language
    };

    console.log('📱 Información del dispositivo:', deviceInfo);

    // Crear datos iniciales de tracking
    const initialTracking: PDFTrackingData = {
      opened: true,
      openedAt: now,
      duration: 0,
      scrollDepth: 0,
      deviceInfo,
      signatureStatus: 'pending',
      lastActivity: now,
      clickTimestamp: now, // Nuevo: timestamp del clic
      clickCount: 1 // Nuevo: contador de clics
    };

    console.log('📊 Tracking inicial creado:', initialTracking);
    setTrackingData(initialTracking);

    // Actualizar en Firestore
    try {
      console.log('🔥 Actualizando Firestore...');
      const messageRef = doc(db, 'mail', messageId);
      const messageDoc = await getDoc(messageRef);
      
      if (messageDoc.exists()) {
        console.log('📄 Documento encontrado, actualizando adjuntos...');
        const messageData = messageDoc.data();
        const attachments = messageData.attachments || [];
        
        // Crear movimiento para apertura de adjunto
        const attachmentMovement = {
          id: generateUUID(),
          type: 'attachment_opened',
          description: `Apertura de archivo adjunto: ${attachmentId}`,
          timestamp: now,
          userAgent: navigator.userAgent,
          clientIP: 'Client', // Se detectará en el servidor
          forwardedIPs: [],
          realIP: 'Client',
          browser: extractBrowserInfo(navigator.userAgent),
          recipientEmail: messageData.recipientEmail || 'Unknown'
        };
        
        // Encontrar y actualizar el adjunto específico
        const updatedAttachments = attachments.map((att: any) => {
          if (att.id === attachmentId) {
            console.log('📎 Actualizando adjunto:', att.id);
            return {
              ...att,
              tracking: initialTracking
            };
          }
          return att;
        });

        // Actualizar el documento
        await updateDoc(messageRef, {
          attachments: updatedAttachments,
          'tracking.attachmentsOpened': increment(1),
          'tracking.lastAttachmentActivity': now,
          'tracking.movements': arrayUnion(attachmentMovement)
        });

        console.log('✅ Tracking de PDF iniciado y guardado en Firestore:', attachmentId);
      } else {
        console.error('❌ Documento no encontrado en Firestore');
      }
    } catch (error) {
      console.error('❌ Error al iniciar tracking en Firestore:', error);
    }
  }, [messageId, attachmentId, isTracking]);

  // Actualizar duración y actividad
  const updateTracking = useCallback(async (updates: Partial<PDFTrackingData>) => {
    if (!trackingData || !isTracking) return;

    const updatedTracking = {
      ...trackingData,
      ...updates,
      lastActivity: new Date()
    };

    setTrackingData(updatedTracking);

    // Actualizar en Firestore
    try {
      const messageRef = doc(db, 'mail', messageId);
      const messageDoc = await getDoc(messageRef);
      
      if (messageDoc.exists()) {
        const messageData = messageDoc.data();
        const attachments = messageData.attachments || [];
        
        const updatedAttachments = attachments.map((att: any) => {
          if (att.id === attachmentId) {
            return {
              ...att,
              tracking: updatedTracking
            };
          }
          return att;
        });

        await updateDoc(messageRef, {
          attachments: updatedAttachments
        });
      }
    } catch (error) {
      console.error('❌ Error al actualizar tracking:', error);
    }
  }, [messageId, attachmentId, trackingData, isTracking]);

  // Manejar scroll
  const handleScroll = useCallback(() => {
    if (!isTracking) return;

    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const scrollHeight = document.documentElement.scrollHeight;
    const clientHeight = document.documentElement.clientHeight;
    
    const scrollDepth = Math.round((scrollTop / (scrollHeight - clientHeight)) * 100);
    
    if (scrollDepth > lastScrollPosition) {
      setLastScrollPosition(scrollDepth);
      updateTracking({ scrollDepth });
    }
  }, [isTracking, lastScrollPosition, updateTracking]);

  // Manejar firma/acuse de recibo
  const handleSignature = useCallback(async (status: 'signed' | 'declined') => {
    if (!trackingData) return;

    const signatureData = {
      signatureStatus: status,
      signatureTimestamp: new Date()
    };

    await updateTracking(signatureData);
    console.log(`✅ Firma registrada: ${status}`);
  }, [trackingData, updateTracking]);

  // Limpiar tracking al cerrar
  const stopTracking = useCallback(async () => {
    if (!isTracking || !startTime) return;

    const endTime = new Date();
    const duration = Math.round((endTime.getTime() - startTime.getTime()) / 1000);

    await updateTracking({
      duration,
      lastActivity: endTime
    });

    setIsTracking(false);
    console.log('🛑 Tracking detenido, duración:', duration, 'segundos');
  }, [isTracking, startTime, updateTracking]);

  // Efectos para manejar eventos
  useEffect(() => {
    if (!isTracking) return;

    // Agregar event listeners
    window.addEventListener('scroll', handleScroll);
    window.addEventListener('beforeunload', stopTracking);

    // Actualizar duración cada 5 segundos
    const durationInterval = setInterval(() => {
      if (startTime) {
        const now = new Date();
        const duration = Math.round((now.getTime() - startTime.getTime()) / 1000);
        updateTracking({ duration });
      }
    }, 5000);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('beforeunload', stopTracking);
      clearInterval(durationInterval);
      stopTracking();
    };
  }, [isTracking, startTime, handleScroll, stopTracking, updateTracking]);

  // Inicializar tracking cuando se monta el componente
  useEffect(() => {
    console.log('🚀 Hook montado, iniciando tracking automáticamente...');
    startTracking();
  }, [startTracking]);

  // También iniciar tracking cuando cambien los parámetros
  useEffect(() => {
    if (messageId && attachmentId && !isTracking) {
      console.log('🔄 Parámetros cambiaron, iniciando tracking...');
      startTracking();
    }
  }, [messageId, attachmentId, isTracking, startTracking]);

  return {
    isTracking,
    trackingData,
    startTracking,
    stopTracking,
    handleSignature,
    updateTracking
  };
}
