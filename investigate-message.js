const admin = require('firebase-admin');

// Inicializar Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: 'notificas-8a8f8'
  });
}

const db = admin.firestore();

async function investigateMessage() {
  console.log('🔍 Investigando mensaje específico: BbDeFfsWCBRrI4nETKEK');
  
  try {
    const docRef = db.collection('mail').doc('BbDeFfsWCBRrI4nETKEK');
    const doc = await docRef.get();
    
    if (!doc.exists) {
      console.log('❌ El mensaje no existe');
      return;
    }
    
    const data = doc.data();
    console.log('📋 Datos del mensaje:');
    console.log(JSON.stringify(data, null, 2));
    
    // Verificar si es un mensaje corrupto
    if (!data.from) {
      console.log('⚠️ MENSAJE CORRUPTO: from es undefined');
    }
    
    if (data.message?.subject === 'Mensaje de prueba desde la app') {
      console.log('⚠️ MENSAJE DE PRUEBA DETECTADO');
    }
    
  } catch (error) {
    console.error('❌ Error investigando mensaje:', error);
  }
}

// Ejecutar investigación
investigateMessage()
  .then(() => {
    console.log('🏁 Investigación completada');
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 Error fatal:', error);
    process.exit(1);
  });
