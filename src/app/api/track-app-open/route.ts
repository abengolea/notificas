import { NextRequest, NextResponse } from 'next/server';
import { doc, getDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '@/lib/firebase';

function extractBrowserInfo(userAgent: string) {
  const browserMatch = userAgent.match(/(Chrome|Firefox|Safari|Edge|Opera)\/(\d+)/);
  if (browserMatch) {
    return `${browserMatch[1]} ${browserMatch[2]}`;
  }
  return 'Unknown';
}

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Manejar OPTIONS para CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

// Endpoint GET para verificar que la ruta funciona
export async function GET() {
  return NextResponse.json(
    { 
      success: true, 
      message: 'Ruta /api/track-app-open está funcionando',
      timestamp: new Date().toISOString(),
      dbInitialized: !!db
    },
    { 
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      }
    }
  );
}

export async function POST(request: NextRequest) {
  // Headers CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  try {
    // Validar que db esté inicializado
    if (!db) {
      console.error('❌ Firebase db no está inicializado');
      return NextResponse.json(
        { error: 'Error de configuración del servidor' },
        { status: 500, headers }
      );
    }

    let body;
    try {
      body = await request.json();
    } catch (parseError: any) {
      console.error('❌ Error parseando JSON:', parseError);
      return NextResponse.json(
        { error: 'JSON inválido en el body', details: parseError?.message },
        { status: 400, headers }
      );
    }

    const { messageId, userEmail } = body || {};

    if (!messageId || typeof messageId !== 'string') {
      return NextResponse.json(
        { error: 'messageId es requerido y debe ser un string' },
        { status: 400, headers }
      );
    }

    console.log('📱 Tracking apertura desde app:', { messageId, userEmail });

    // Obtener información del request
    const userAgent = request.headers.get('User-Agent') || 'Unknown';
    const clientIP = request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() || 
                     request.headers.get('X-Real-IP') || 
                     'Unknown';
    const forwardedIPs = request.headers.get('X-Forwarded-For') ? 
                        request.headers.get('X-Forwarded-For')!.split(',').map(ip => ip.trim()) : [];
    const realIP = request.headers.get('X-Real-IP') || 'Unknown';

    // Obtener el documento del mensaje
    let messageRef;
    let messageDoc;
    
    try {
      messageRef = doc(db, 'mail', messageId);
      messageDoc = await getDoc(messageRef);
    } catch (firestoreError: any) {
      console.error('❌ Error accediendo a Firestore:', firestoreError);
      return NextResponse.json(
        { 
          error: 'Error accediendo a la base de datos',
          details: process.env.NODE_ENV === 'development' ? firestoreError?.message : undefined
        },
        { status: 500, headers }
      );
    }

    if (!messageDoc.exists()) {
      return NextResponse.json(
        { error: 'Mensaje no encontrado' },
        { status: 404, headers }
      );
    }

    const messageData = messageDoc.data();

    // Verificar que el usuario es destinatario del mensaje
    const recipients = Array.isArray(messageData.to) ? messageData.to : [messageData.to];
    if (userEmail && !recipients.includes(userEmail)) {
      console.log('⚠️ Usuario no es destinatario del mensaje');
      // No retornar error, solo no trackear
    }

    // Obtener movimientos existentes
    const existingMovements = messageData.tracking?.movements || [];
    
    // Verificar si ya hay un movimiento de apertura desde app reciente (últimos 5 segundos)
    const now = Date.now();
    const fiveSecondsAgo = now - 5000;
    
    const recentAppOpen = existingMovements
      .filter((m: any) => m.type === 'app_opened')
      .find((m: any) => {
        const movementTime = new Date(m.timestamp).getTime();
        return movementTime > fiveSecondsAgo;
      });
    
    if (recentAppOpen) {
      console.log('⚠️ Apertura desde app ya registrada recientemente, omitiendo duplicado');
      return NextResponse.json(
        { 
          success: true, 
          message: 'Apertura ya registrada',
          skipped: true 
        },
        { status: 200, headers }
      );
    }

    // Crear movimiento para apertura desde app
    const appOpenMovement = {
      id: generateUUID(),
      type: 'app_opened',
      description: 'Apertura de mensaje desde la aplicación web',
      timestamp: new Date().toISOString(),
      userAgent: userAgent,
      clientIP: clientIP,
      forwardedIPs: forwardedIPs,
      realIP: realIP,
      browser: extractBrowserInfo(userAgent),
      recipientEmail: userEmail || messageData.recipientEmail || 'Unknown',
      source: 'app_web'
    };

    // Actualizar el documento con el nuevo movimiento
    try {
      const wasFirstOpen = !messageData.tracking?.opened;

      await updateDoc(messageRef, {
        'tracking.opened': true,
        'tracking.openedAt': new Date(),
        'tracking.openCount': (messageData.tracking?.openCount || 0) + 1,
        'tracking.movements': arrayUnion(appOpenMovement),
        'tracking.lastAppOpenAt': new Date()
      });

      // Certificar recepción en Polygon (primera vez que se abre, desde app o email)
      if (wasFirstOpen) {
        try {
          const host = request.headers.get('host') || 'localhost:9006';
          const proto = request.headers.get('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https');
          const base = `${proto}://${host}`;
          const certifyRes = await fetch(`${base}/api/polygon/certify-event`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              docId: messageId,
              type: 'receive',
              userId: messageData.recipientEmail || messageData.to?.[0],
            }),
          });
          if (!certifyRes.ok) console.warn('⚠️ Polygon certify receive (app-open):', await certifyRes.text());
          else console.log('🔗 Recepción certificada en Polygon desde app');
        } catch (e: any) {
          console.warn('⚠️ Polygon certify receive failed:', e?.message);
        }
      }

      console.log('✅ Tracking de apertura desde app registrado:', appOpenMovement.id);

      return NextResponse.json(
        { 
          success: true, 
          movementId: appOpenMovement.id 
        },
        { status: 200, headers }
      );
    } catch (updateError: any) {
      console.error('❌ Error actualizando documento:', updateError);
      return NextResponse.json(
        { 
          error: 'Error al actualizar el tracking',
          details: process.env.NODE_ENV === 'development' ? updateError?.message : undefined
        },
        { status: 500, headers }
      );
    }

  } catch (error: any) {
    console.error('❌ Error inesperado al trackear apertura desde app:', error);
    console.error('❌ Stack trace:', error?.stack);
    console.error('❌ Error name:', error?.name);
    console.error('❌ Error message:', error?.message);
    
    // Asegurar que siempre se retorna una respuesta
    return NextResponse.json(
      { 
        error: error?.message || 'Error al trackear apertura',
        details: process.env.NODE_ENV === 'development' ? error?.stack : undefined
      },
      { status: 500, headers }
    );
  }
}

