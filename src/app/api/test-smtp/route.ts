import { NextRequest, NextResponse } from 'next/server';
import * as nodemailer from 'nodemailer';

export async function POST(request: NextRequest) {
  try {
    console.log('🔧 Probando conexión SMTP...');
    
    // Configuración SMTP (igual que en functions/index.js)
    const transporter = nodemailer.createTransport({
      host: 'vps-1711372-x.dattaweb.com',
      port: 587,
      secure: false,
      auth: {
        user: 'contacto@notificas.com',
        pass: '3JF9x*a2xS'
      }
    });

    // Probar conexión
    await transporter.verify();
    
    console.log('✅ Conexión SMTP exitosa');
    
    return NextResponse.json({
      success: true,
      message: 'Conexión SMTP exitosa',
      details: {
        host: 'vps-1711372-x.dattaweb.com',
        port: 587,
        user: 'contacto@notificas.com',
        secure: false
      }
    });
    
  } catch (error: any) {
    console.error('❌ Error en conexión SMTP:', error);
    
    return NextResponse.json({
      success: false,
      message: `Error de conexión SMTP: ${error.message}`,
      details: {
        error: error.message,
        code: error.code,
        command: error.command
      }
    }, { status: 500 });
  }
}
