import { NextRequest, NextResponse } from 'next/server';
import * as nodemailer from 'nodemailer';

export async function POST(request: NextRequest) {
  try {
    const { to, subject, content } = await request.json();
    
    console.log('📧 Enviando email de prueba...', { to, subject });
    
    // Configuración SMTP
    const transporter = nodemailer.createTransport({
      host: 'vps-1711372-x.dattaweb.com',
      port: 587,
      secure: false,
      auth: {
        user: 'contacto@notificas.com',
        pass: '3JF9x*a2xS'
      }
    });

    // Configurar email
    const mailOptions = {
      from: 'contacto@notificas.com',
      to: to,
      subject: subject,
      text: content,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #0D9488;">Test de Email - Panel de Administración</h2>
          <p>${content}</p>
          <hr style="margin: 20px 0;">
          <p style="color: #666; font-size: 12px;">
            Este es un mensaje de prueba enviado desde el panel de administración de Notificas.com
          </p>
        </div>
      `
    };

    // Enviar email
    const result = await transporter.sendMail(mailOptions);
    
    console.log('✅ Email enviado exitosamente:', result.messageId);
    
    return NextResponse.json({
      success: true,
      message: 'Email enviado exitosamente',
      details: {
        messageId: result.messageId,
        accepted: result.accepted,
        rejected: result.rejected,
        response: result.response
      }
    });
    
  } catch (error: any) {
    console.error('❌ Error enviando email:', error);
    
    return NextResponse.json({
      success: false,
      message: `Error enviando email: ${error.message}`,
      details: {
        error: error.message,
        code: error.code,
        command: error.command
      }
    }, { status: 500 });
  }
}
