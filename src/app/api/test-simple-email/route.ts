import { NextRequest, NextResponse } from 'next/server';
import * as nodemailer from 'nodemailer';

export async function POST(request: NextRequest) {
  try {
    const { to, subject, content } = await request.json();
    
    console.log('📧 Enviando email SIMPLE (sin tracking)...', { to, subject });
    
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

    // Email SIMPLE sin tracking
    const mailOptions = {
      from: 'contacto@notificas.com',
      to: to,
      subject: subject,
      text: content,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #0D9488;">Test Simple - Sin Tracking</h2>
          <p>${content}</p>
          <hr style="margin: 20px 0;">
          <p style="color: #666; font-size: 12px;">
            Este es un mensaje de prueba SIMPLE sin tracking ni imágenes.
          </p>
        </div>
      `
    };

    // Enviar email
    const result = await transporter.sendMail(mailOptions);
    
    console.log('✅ Email simple enviado:', result.messageId);
    
    return NextResponse.json({
      success: true,
      message: 'Email simple enviado exitosamente',
      details: {
        messageId: result.messageId,
        accepted: result.accepted,
        rejected: result.rejected,
        response: result.response
      }
    });
    
  } catch (error: any) {
    console.error('❌ Error enviando email simple:', error);
    
    return NextResponse.json({
      success: false,
      message: `Error enviando email simple: ${error.message}`,
      details: {
        error: error.message,
        code: error.code
      }
    }, { status: 500 });
  }
}
