#!/usr/bin/env node

/**
 * Script para configurar webhook de Mailgun para correos entrantes
 * Este script configura Mailgun para que los correos enviados a contacto@notificas.com
 * se procesen automáticamente por la función processIncomingEmail
 */

const https = require('https');

// Configuración
const MAILGUN_API_KEY = process.env.MAILGUN_API_KEY || 'your-mailgun-api-key';
const MAILGUN_DOMAIN = 'notificas.com'; // Tu dominio en Mailgun
const WEBHOOK_URL = 'https://us-central1-notificas-f9953.cloudfunctions.net/processIncomingEmail';

console.log('🔧 Configurando webhook de Mailgun...');
console.log(`📧 Dominio: ${MAILGUN_DOMAIN}`);
console.log(`🔗 Webhook: ${WEBHOOK_URL}`);

// Función para configurar webhook en Mailgun
async function configureMailgunWebhook() {
  const webhookData = {
    url: WEBHOOK_URL,
    event: 'incoming'
  };

  const postData = JSON.stringify(webhookData);
  
  const options = {
    hostname: 'api.mailgun.net',
    port: 443,
    path: `/v3/domains/${MAILGUN_DOMAIN}/webhooks`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData),
      'Authorization': `Basic ${Buffer.from(`api:${MAILGUN_API_KEY}`).toString('base64')}`
    }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          resolve({ status: res.statusCode, data: result });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

// Función para verificar webhooks existentes
async function listMailgunWebhooks() {
  const options = {
    hostname: 'api.mailgun.net',
    port: 443,
    path: `/v3/domains/${MAILGUN_DOMAIN}/webhooks`,
    method: 'GET',
    headers: {
      'Authorization': `Basic ${Buffer.from(`api:${MAILGUN_API_KEY}`).toString('base64')}`
    }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          resolve({ status: res.statusCode, data: result });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

// Función para mostrar instrucciones de configuración manual
function showManualConfiguration() {
  console.log('\n📋 CONFIGURACIÓN MANUAL DEL SERVIDOR SMTP:');
  console.log('=' .repeat(60));
  
  console.log('\n1. CONFIGURAR WEBHOOK EN TU SERVIDOR SMTP:');
  console.log('   - URL del webhook:', WEBHOOK_URL);
  console.log('   - Método: POST');
  console.log('   - Content-Type: application/json');
  console.log('   - Evento: cuando llegue un correo a contacto@notificas.com');
  
  console.log('\n2. FORMATO DEL PAYLOAD QUE DEBE ENVIAR:');
  console.log('   {');
  console.log('     "from": "usuario@email.com",');
  console.log('     "to": "contacto@notificas.com",');
  console.log('     "subject": "CERTIFICAR - destinatario@email.com - Asunto: Mi mensaje",');
  console.log('     "text": "Contenido del mensaje",');
  console.log('     "html": "<p>Contenido del mensaje</p>"');
  console.log('   }');
  
  console.log('\n3. CONFIGURAR EN TU SERVIDOR:');
  console.log('   - Buscar configuración de "webhooks" o "callbacks"');
  console.log('   - Agregar la URL del webhook');
  console.log('   - Configurar para que se active en correos entrantes');
  console.log('   - Probar con un correo de prueba');
  
  console.log('\n4. ALTERNATIVA: USAR SERVICIO DE WEBHOOK:');
  console.log('   - Mailgun: https://www.mailgun.com/');
  console.log('   - SendGrid: https://sendgrid.com/');
  console.log('   - Postmark: https://postmarkapp.com/');
  console.log('   - Configurar el webhook en el servicio elegido');
}

// Función para crear un script de prueba
function createTestScript() {
  const testScript = `
#!/usr/bin/env node

/**
 * Script de prueba para simular un correo entrante
 * Ejecuta: node test-incoming-email.js
 */

const https = require('https');

const WEBHOOK_URL = '${WEBHOOK_URL}';

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
`;

  const fs = require('fs');
  const path = require('path');
  const testScriptPath = path.join(__dirname, '..', 'test-incoming-email.js');
  fs.writeFileSync(testScriptPath, testScript);
  console.log(`\n📄 Script de prueba creado: ${testScriptPath}`);
  console.log('   Ejecuta: node test-incoming-email.js');
}

// Función principal
async function main() {
  console.log('🚀 Iniciando configuración de webhook de Mailgun...\n');
  
  if (MAILGUN_API_KEY === 'your-mailgun-api-key') {
    console.log('⚠️  No se encontró MAILGUN_API_KEY en las variables de entorno');
    console.log('   Configurando para configuración manual...\n');
  } else {
    try {
      // Listar webhooks existentes
      console.log('📋 Listando webhooks existentes...');
      const listResult = await listMailgunWebhooks();
      console.log('📊 Webhooks existentes:', listResult.data);
      
      // Configurar nuevo webhook
      console.log('\n🔧 Configurando nuevo webhook...');
      const webhookResult = await configureMailgunWebhook();
      console.log('📊 Resultado:', webhookResult);
      
      if (webhookResult.status === 200) {
        console.log('✅ Webhook configurado exitosamente en Mailgun!');
      } else {
        console.log('❌ Error al configurar webhook en Mailgun');
      }
    } catch (error) {
      console.log('❌ Error:', error.message);
      console.log('   Continuando con configuración manual...\n');
    }
  }
  
  // Mostrar instrucciones de configuración manual
  showManualConfiguration();
  
  // Crear script de prueba
  createTestScript();
  
  console.log('\n✅ Configuración completada!');
  console.log('\n📝 PRÓXIMOS PASOS:');
  console.log('1. Configura el webhook en tu servidor SMTP');
  console.log('2. Prueba con: node test-incoming-email.js');
  console.log('3. Envía un correo real desde Gmail con el formato correcto');
  console.log('4. Verifica que aparezca en la aplicación');
}

// Ejecutar si se llama directamente
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { configureMailgunWebhook, listMailgunWebhooks, showManualConfiguration };
