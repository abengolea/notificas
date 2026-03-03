const admin = require('firebase-admin');

// Inicializar Firebase Admin
const serviceAccount = require('./firebase-service-account.json');
admin.initializeApp({
  credential: admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  }),
  projectId: 'notificas-f9953'
});

const db = admin.firestore();

async function cleanTestDocuments() {
  try {
    console.log('🧹 Limpiando documentos de prueba...');
    
    // Buscar documentos que empiecen con 'test_'
    const snapshot = await db.collection('mail')
      .where('__name__', '>=', 'test_')
      .where('__name__', '<', 'test_\uf8ff')
      .get();
    
    if (snapshot.empty) {
      console.log('✅ No se encontraron documentos de prueba');
      return;
    }
    
    console.log(`📋 Encontrados ${snapshot.size} documentos de prueba`);
    
    // Eliminar cada documento
    const deletePromises = snapshot.docs.map(doc => {
      console.log(`🗑️  Eliminando: ${doc.id}`);
      return doc.ref.delete();
    });
    
    await Promise.all(deletePromises);
    console.log(`✅ Se eliminaron ${snapshot.size} documentos de prueba`);
    
  } catch (error) {
    console.error('❌ Error limpiando documentos:', error);
  } finally {
    process.exit(0);
  }
}

cleanTestDocuments();
