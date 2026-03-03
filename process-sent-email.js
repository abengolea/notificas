/**
 * Script para procesar el correo que acabas de enviar desde Gmail
 * Simula el procesamiento que haría el webhook automático
 */

const https = require('https');

// Datos del correo que enviaste desde Gmail
const emailData = {
  from: 'abengolea1@gmail.com',
  to: 'contacto@notificas.com',
  subject: 'CERTIFICAR - goyitobengolea@gmail.com - Asunto: Tu mensaje aquí',
  text: 'fdls jfdslk jdfsl',
  html: '<p>fdls jfdslk jdfsl</p>'
};

const WEBHOOK_URL = 'https://us-central1-notificas-f9953.cloudfunctions.net/processIncomingEmail';

console.log('📧 Procesando correo enviado desde Gmail...');
console.log('📤 De:', emailData.from);
console.log('📥 Para:', emailData.to);
console.log('📋 Asunto:', emailData.subject);
console.log('');

const postData = JSON.stringify(emailData);

const options = {
  hostname: 'us-central1-notificas-f9953.cloudfunctions.net',
  port: 443,
  path: '/processIncomingEmail',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};

console.log('🚀 Enviando a webhook...');

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    console.log('📊 Respuesta del servidor:', res.statusCode);
    
    try {
      const result = JSON.parse(data);
      console.log('📄 Resultado:', JSON.stringify(result, null, 2));
      
      if (res.statusCode === 200 && result.success) {
        console.log('');
        console.log('✅ ¡Correo procesado exitosamente!');
        console.log('📧 ID del mensaje:', result.messageId);
        console.log('📄 ID del documento:', result.docId);
        console.log('👤 Destinatario:', result.recipient);
        console.log('📋 Asunto procesado:', result.subject);
        console.log('');
        console.log('🔍 Ahora revisa la aplicación en http://localhost:9006');
        console.log('   - Ve a "Enviados" para ver el correo');
        console.log('   - El destinatario recibirá el correo certificado');
      } else {
        console.log('❌ Error al procesar correo:', result.error || result.message);
      }
    } catch (e) {
      console.log('❌ Error al parsear respuesta:', data);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Error de conexión:', error.message);
});

req.write(postData);
req.end();
