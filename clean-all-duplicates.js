const admin = require('firebase-admin');

// Inicializar Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: 'notificas-8a8f8'
  });
}

const db = admin.firestore();

async function cleanAllDuplicates() {
  console.log('🧹 LIMPIEZA AGRESIVA DE TODOS LOS DUPLICADOS...');
  
  try {
    // Obtener todos los correos
    const snapshot = await db.collection('mail').get();
    console.log(`📊 Total de correos encontrados: ${snapshot.size}`);
    
    let deletedCount = 0;
    let validCount = 0;
    const batch = db.batch();
    
    for (const doc of snapshot.docs) {
      const data = doc.data();
      
      // Criterios AGRESIVOS para eliminar:
      const shouldDelete = 
        // 1. Correos con from undefined
        !data.from ||
        // 2. Correos con subject del formato viejo
        data.message?.subject?.includes('Mensaje certificado de abengolea1@gmail.com') ||
        // 3. Correos con subject de prueba
        data.message?.subject?.includes('Mensaje de prueba desde la app') ||
        // 4. Correos sin delivery state (incompletos)
        (!data.delivery?.state && data.message?.subject?.includes('Mensaje certificado')) ||
        // 5. Correos con timestamp muy reciente pero formato viejo (duplicados recientes)
        (data.message?.subject?.includes('Mensaje certificado de abengolea1@gmail.com') && 
         data.timestamp && 
         new Date(data.timestamp) > new Date('2025-01-04T00:00:00Z'));
      
      if (shouldDelete) {
        console.log(`🗑️ ELIMINANDO: ${doc.id} - ${data.message?.subject || 'Sin asunto'} - from: ${data.from || 'undefined'}`);
        batch.delete(doc.ref);
        deletedCount++;
        
        // Procesar en lotes de 500
        if (deletedCount % 500 === 0) {
          await batch.commit();
          console.log(`✅ Lote procesado: ${deletedCount} eliminados hasta ahora`);
        }
      } else {
        validCount++;
        console.log(`✅ MANTENIENDO: ${doc.id} - ${data.message?.subject || 'Sin asunto'}`);
      }
    }
    
    // Commit final
    if (deletedCount % 500 !== 0) {
      await batch.commit();
    }
    
    console.log(`\n🎯 LIMPIEZA COMPLETADA:`);
    console.log(`✅ Correos válidos mantenidos: ${validCount}`);
    console.log(`🗑️ Correos eliminados: ${deletedCount}`);
    console.log(`📊 Total procesados: ${snapshot.size}`);
    
  } catch (error) {
    console.error('❌ Error en limpieza:', error);
  } finally {
    process.exit(0);
  }
}

// Ejecutar limpieza
cleanAllDuplicates();
