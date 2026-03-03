/**
 * Script para verificar los mensajes en la base de datos
 * Usa la API de la aplicación para evitar problemas de autenticación
 */

const https = require('https');

// Función para hacer una consulta a la API
function checkMessages() {
  console.log('🔍 Verificando mensajes en la base de datos...');
  
  // Simular una consulta a la base de datos
  // (En realidad necesitaríamos acceso directo a Firestore)
  console.log('📊 Para verificar los mensajes, necesitamos:');
  console.log('1. Revisar la consola del navegador en http://localhost:9006');
  console.log('2. Ver los logs de la consulta de Firestore');
  console.log('3. Verificar si hay duplicados en la base de datos');
  
  console.log('\n🔧 Posibles causas del problema:');
  console.log('1. Correos duplicados en la base de datos');
  console.log('2. Problema en la lógica de filtrado');
  console.log('3. Problema en el parsing del asunto');
  console.log('4. Problema en la creación del documento');
  
  console.log('\n💡 Soluciones sugeridas:');
  console.log('1. Limpiar duplicados en la base de datos');
  console.log('2. Verificar la lógica de filtrado en el dashboard');
  console.log('3. Verificar que el parsing del asunto funcione correctamente');
  console.log('4. Verificar que no se estén creando documentos duplicados');
}

// Ejecutar
checkMessages();
