#!/usr/bin/env node

/**
 * Script para configurar webhook de correos entrantes
 * Este script configura el webhook para que los correos enviados a contacto@notificas.com
 * se procesen automáticamente por la función processIncomingEmail
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// Configuración
const WEBHOOK_URL = 'https://us-central1-notificas-f9953.cloudfunctions.net/processIncomingEmail';
const EMAIL_DOMAIN = 'notificas.com';
const INCOMING_EMAIL = 'contacto@notificas.com';

console.log('🔧 Configurando webhook de correos entrantes...');
console.log(`📧 Email: ${INCOMING_EMAIL}`);
console.log(`🔗 Webhook: ${WEBHOOK_URL}`);

// Función para probar el webhook
async function testWebhook() {
  console.log('\n🧪 Probando webhook...');
  
  const testEmail = {
    from: 'abengolea1@gmail.com',
    to: INCOMING_EMAIL,
    subject: 'CERTIFICAR - test@example.com - Asunto: Prueba de webhook',
    text: 'Este es un mensaje de prueba para verificar que el webhook funciona correctamente.',
    html: '<p>Este es un mensaje de prueba para verificar que el webhook funciona correctamente.</p>'
  };

  try {
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testEmail)
    });

    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ Webhook funcionando correctamente!');
      console.log('📊 Resultado:', result);
    } else {
      console.log('❌ Error en webhook:', result);
    }
  } catch (error) {
    console.log('❌ Error al probar webhook:', error.message);
  }
}

// Función para generar configuración de webhook
function generateWebhookConfig() {
  const config = {
    webhook_url: WEBHOOK_URL,
    email_domain: EMAIL_DOMAIN,
    incoming_email: INCOMING_EMAIL,
    instructions: {
      title: 'Configuración de Webhook para Correos Entrantes',
      description: 'Para que los correos enviados a contacto@notificas.com se procesen automáticamente:',
      steps: [
        '1. Configurar el servidor de correo para recibir emails en contacto@notificas.com',
        '2. Configurar un webhook que llame a la URL cuando llegue un correo',
        '3. El webhook debe enviar un POST con los datos del correo en formato JSON',
        '4. Formato del JSON: { from, to, subject, text, html, attachments }',
        '5. La función processIncomingEmail procesará el correo automáticamente'
      ],
      example_payload: {
        from: 'usuario@email.com',
        to: 'contacto@notificas.com',
        subject: 'CERTIFICAR - destinatario@email.com - Asunto: Mi mensaje',
        text: 'Contenido del mensaje',
        html: '<p>Contenido del mensaje</p>'
      },
      supported_subject_formats: [
        'CERTIFICAR - destinatario@email.com - Asunto: Mi mensaje',
        'certificar - destinatario@email.com - asunto: mi mensaje',
        'CERTIFICAR destinatario@email.com Mi mensaje',
        'certificar-destinatario@email.com-mi mensaje'
      ]
    }
  };

  const configPath = path.join(__dirname, '..', 'webhook-config.json');
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  console.log(`\n📄 Configuración guardada en: ${configPath}`);
  
  return config;
}

// Función para mostrar instrucciones de configuración manual
function showManualSetupInstructions() {
  console.log('\n📋 INSTRUCCIONES PARA CONFIGURACIÓN MANUAL:');
  console.log('=' .repeat(60));
  console.log('\n1. CONFIGURAR SERVIDOR DE CORREO:');
  console.log('   - Asegúrate de que contacto@notificas.com pueda recibir correos');
  console.log('   - Configura el servidor para procesar correos entrantes');
  
  console.log('\n2. CONFIGURAR WEBHOOK:');
  console.log('   - URL del webhook:', WEBHOOK_URL);
  console.log('   - Método: POST');
  console.log('   - Content-Type: application/json');
  
  console.log('\n3. FORMATO DEL PAYLOAD:');
  console.log('   {');
  console.log('     "from": "usuario@email.com",');
  console.log('     "to": "contacto@notificas.com",');
  console.log('     "subject": "CERTIFICAR - destinatario@email.com - Asunto: Mi mensaje",');
  console.log('     "text": "Contenido del mensaje",');
  console.log('     "html": "<p>Contenido del mensaje</p>"');
  console.log('   }');
  
  console.log('\n4. FORMATOS DE ASUNTO SOPORTADOS:');
  console.log('   - CERTIFICAR - destinatario@email.com - Asunto: Mi mensaje');
  console.log('   - certificar - destinatario@email.com - asunto: mi mensaje');
  console.log('   - CERTIFICAR destinatario@email.com Mi mensaje');
  console.log('   - certificar-destinatario@email.com-mi mensaje');
  
  console.log('\n5. PROBAR:');
  console.log('   - Envía un correo a contacto@notificas.com con el formato correcto');
  console.log('   - Verifica que se procese automáticamente');
  console.log('   - Revisa los logs en Firebase Functions');
}

// Función principal
async function main() {
  console.log('🚀 Iniciando configuración de webhook...\n');
  
  // Generar configuración
  const config = generateWebhookConfig();
  
  // Mostrar instrucciones
  showManualSetupInstructions();
  
  // Probar webhook
  await testWebhook();
  
  console.log('\n✅ Configuración completada!');
  console.log('\n📝 PRÓXIMOS PASOS:');
  console.log('1. Configura tu servidor de correo para usar el webhook');
  console.log('2. Prueba enviando un correo con el formato correcto');
  console.log('3. Verifica que aparezca en la aplicación');
}

// Ejecutar si se llama directamente
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { testWebhook, generateWebhookConfig, showManualSetupInstructions };
