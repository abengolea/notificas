
/**
 * Script de prueba para simular un correo entrante
 * Ejecuta: node test-incoming-email.js
 */

const https = require('https');

const WEBHOOK_URL = 'https://us-central1-notificas-f9953.cloudfunctions.net/processIncomingEmail';

const testEmail = {
  from: 'abengolea1@gmail.com',
  to: 'contacto@notificas.com',
  subject: 'CERTIFICAR - test@example.com - Asunto: Prueba desde Gmail',
  text: 'Este es un mensaje de prueba enviado desde Gmail con el formato correcto.',
  html: '<p>Este es un mensaje de prueba enviado desde Gmail con el formato correcto.</p>'
};

console.log('🧪 Enviando correo de prueba...');
console.log('📧 Asunto:', testEmail.subject);

const postData = JSON.stringify(testEmail);

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

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    console.log('📊 Respuesta:', res.statusCode);
    console.log('📄 Resultado:', data);
    
    if (res.statusCode === 200) {
      console.log('✅ ¡Correo procesado exitosamente!');
    } else {
      console.log('❌ Error al procesar correo');
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Error:', error.message);
});

req.write(postData);
req.end();
