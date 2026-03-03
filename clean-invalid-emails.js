const admin = require('firebase-admin');

// Inicializar Firebase Admin con variables de entorno
admin.initializeApp();

const db = admin.firestore();

async function cleanInvalidEmails() {
  try {
    console.log('🧹 Iniciando limpieza de correos inválidos...');
    
    // Obtener todos los correos
    const snapshot = await db.collection('mail').get();
    console.log(`📊 Total de correos encontrados: ${snapshot.size}`);
    
    let deletedCount = 0;
    let validCount = 0;
    
    for (const doc of snapshot.docs) {
      const data = doc.data();
      
      // Criterios para eliminar correos inválidos:
      const shouldDelete = 
        // 1. Correos con subject del formato viejo
        data.message?.subject?.includes('Mensaje certificado de abengolea1@gmail.com') ||
        // 2. Correos sin delivery state (incompletos)
        (!data.delivery?.state && data.message?.subject?.includes('Mensaje certificado')) ||
        // 3. Correos con from undefined
        (!data.from && data.message?.subject?.includes('Mensaje certificado')) ||
        // 4. Correos duplicados recientes (mismo subject, mismo timestamp)
        (data.message?.subject?.includes('Mensaje certificado de abengolea1@gmail.com') && 
         data.timestamp && 
         new Date(data.timestamp) > new Date('2025-01-04T15:00:00Z'));
      
      if (shouldDelete) {
        console.log(`🗑️ Eliminando: ${doc.id} - ${data.message?.subject}`);
        await doc.ref.delete();
        deletedCount++;
      } else {
        validCount++;
        console.log(`✅ Manteniendo: ${doc.id} - ${data.message?.subject}`);
      }
    }
    
    console.log(`\n📈 Resumen:`);
    console.log(`✅ Correos válidos mantenidos: ${validCount}`);
    console.log(`🗑️ Correos eliminados: ${deletedCount}`);
    console.log(`📊 Total procesados: ${snapshot.size}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

cleanInvalidEmails();
