const admin = require('firebase-admin');

// Inicializar Firebase Admin
const serviceAccount = require('./functions/serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'notificas-f9953'
});

const db = admin.firestore();

async function cleanDuplicates() {
  try {
    console.log('🧹 Iniciando limpieza de duplicados...');
    
    // Obtener todos los documentos de mail
    const snapshot = await db.collection('mail').get();
    console.log(`📊 Total de documentos encontrados: ${snapshot.size}`);
    
    // Identificar duplicados por senderName, recipientEmail y subject
    const groups = {};
    const duplicates = [];
    
    snapshot.forEach(doc => {
      const data = doc.data();
      const key = `${data.senderName || 'unknown'}-${data.recipientEmail || 'unknown'}-${data.message?.subject || 'unknown'}`;
      
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push({ id: doc.id, data });
    });
    
    // Encontrar grupos con múltiples entradas
    Object.entries(groups).forEach(([key, docs]) => {
      if (docs.length > 1) {
        console.log(`\n🔍 Grupo duplicado encontrado: ${key}`);
        console.log(`   Cantidad: ${docs.length} documentos`);
        
        // Separar correctos de incorrectos
        const correct = docs.filter(doc => doc.data.from === 'contacto@notificas.com');
        const incorrect = docs.filter(doc => doc.data.from === 'abengolea1@gmail.com');
        
        console.log(`   ✅ Correctos (contacto@notificas.com): ${correct.length}`);
        console.log(`   ❌ Incorrectos (abengolea1@gmail.com): ${incorrect.length}`);
        
        // Agregar incorrectos a la lista de eliminación
        incorrect.forEach(doc => {
          duplicates.push(doc.id);
        });
      }
    });
    
    console.log(`\n📋 Total de duplicados a eliminar: ${duplicates.length}`);
    
    if (duplicates.length > 0) {
      console.log('\n🗑️ Eliminando duplicados...');
      
      // Eliminar en lotes de 10
      const batchSize = 10;
      for (let i = 0; i < duplicates.length; i += batchSize) {
        const batch = db.batch();
        const batchDuplicates = duplicates.slice(i, i + batchSize);
        
        batchDuplicates.forEach(id => {
          batch.delete(db.collection('mail').doc(id));
        });
        
        await batch.commit();
        console.log(`   ✅ Eliminados ${batchDuplicates.length} documentos (${i + 1}-${Math.min(i + batchSize, duplicates.length)})`);
      }
      
      console.log(`\n🎉 Limpieza completada! Se eliminaron ${duplicates.length} duplicados.`);
    } else {
      console.log('\n✅ No se encontraron duplicados para eliminar.');
    }
    
  } catch (error) {
    console.error('❌ Error durante la limpieza:', error);
  }
}

cleanDuplicates();