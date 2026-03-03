import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 Endpoint /api/processIncomingEmail llamado');
    const emailData = await request.json();
    console.log('📧 Datos del correo entrante:', emailData);
    
    if (!emailData.from || !emailData.subject) {
      console.log('❌ from y subject son requeridos');
      return NextResponse.json({ error: 'from y subject son requeridos' }, { status: 400 });
    }

    // Llamar a la función de Firebase
    const region = 'us-central1';
    const projectId = 'notificas-f9953';
    const functionUrl = `https://${region}-${projectId}.cloudfunctions.net/processIncomingEmail`;
    
    console.log('🌐 Llamando a Firebase Function:', functionUrl);
    
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailData)
    });

    console.log('📡 Respuesta de Firebase:', response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Error en función de Firebase:', errorText);
      return NextResponse.json({ error: 'Error al procesar correo entrante' }, { status: 500 });
    }

    const result = await response.json();
    console.log('✅ Resultado exitoso:', result);
    return NextResponse.json(result);
    
  } catch (error) {
    console.error('❌ Error en endpoint processIncomingEmail:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
