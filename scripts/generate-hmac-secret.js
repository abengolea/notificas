#!/usr/bin/env node

/**
 * Script para generar un secreto HMAC seguro para el tracking
 * Ejecutar: node scripts/generate-hmac-secret.js
 */

const crypto = require('crypto');

function generateHMACSecret() {
  // Generar un secreto aleatorio de 64 bytes (512 bits)
  const secret = crypto.randomBytes(64).toString('hex');
  
  console.log('🔐 SECRETO HMAC GENERADO:');
  console.log('=====================================');
  console.log(secret);
  console.log('=====================================');
  console.log('');
  console.log('📋 INSTRUCCIONES:');
  console.log('1. Copia este secreto');
  console.log('2. Agrégalo a tu archivo .env en functions/');
  console.log('3. Agrégalo a las variables de entorno de Firebase Functions');
  console.log('');
  console.log('⚠️  IMPORTANTE:');
  console.log('- Mantén este secreto seguro y privado');
  console.log('- No lo compartas ni lo subas a Git');
  console.log('- Usa el mismo secreto en todos los entornos');
  console.log('');
  console.log('🚀 DEPLOY:');
  console.log('firebase functions:config:set tracking.hmac_secret="' + secret + '"');
  console.log('firebase deploy --only functions');
  
  return secret;
}

// Generar el secreto
generateHMACSecret();
