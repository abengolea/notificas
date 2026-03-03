const admin = require('firebase-admin');

// Inicializar Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: 'notificas-8a8f8'
  });
}

const db = admin.firestore();

async function cleanCorruptedMessages() {
  console.log('🧹 Iniciando limpieza de mensajes corruptos...');
  
  try {
    // Buscar mensajes con from undefined o subject sospechoso
    const corruptedQuery = db.collection('mail')
      .where('from', '==', undefined)
      .limit(100);
    
    const snapshot = await corruptedQuery.get();
    
    if (snapshot.empty) {
      console.log('✅ No se encontraron mensajes corruptos');
      return;
    }
    
    console.log(`🔍 Encontrados ${snapshot.size} mensajes corruptos`);
    
    const batch = db.batch();
    let deleteCount = 0;
    
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      console.log(`🗑️ Eliminando mensaje corrupto:`, {
        id: doc.id,
        from: data.from,
        subject: data.message?.subject,
        timestamp: data.timestamp
      });
      
      batch.delete(doc.ref);
      deleteCount++;
    });
    
    if (deleteCount > 0) {
      await batch.commit();
      console.log(`✅ Eliminados ${deleteCount} mensajes corruptos`);
    }
    
  } catch (error) {
    console.error('❌ Error limpiando mensajes corruptos:', error);
  }
}

// Ejecutar limpieza
cleanCorruptedMessages()
  .then(() => {
    console.log('🏁 Limpieza completada');
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 Error fatal:', error);
    process.exit(1);
  });
