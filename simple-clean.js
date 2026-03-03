// Script simple para limpiar duplicados
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, deleteDoc, doc, query, where } = require('firebase/firestore');

// Configuración de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyBvQZvQZvQZvQZvQZvQZvQZvQZvQZvQZvQ",
  authDomain: "notificas-f9953.firebaseapp.com",
  projectId: "notificas-f9953",
  storageBucket: "notificas-f9953.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef123456"
};

async function cleanDuplicates() {
  try {
    console.log('🧹 Iniciando limpieza de duplicados...');
    
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    
    // Obtener todos los correos
    const snapshot = await getDocs(collection(db, 'mail'));
    console.log(`📊 Total de correos encontrados: ${snapshot.size}`);
    
    let duplicates = 0;
    const toDelete = [];
    
    // Identificar duplicados por senderName, recipientEmail y subject
    const seen = new Set();
    
    snapshot.forEach((docSnapshot) => {
      const data = docSnapshot.data();
      const key = `${data.senderName}-${data.recipientEmail}-${data.message?.subject}`;
      
      if (seen.has(key)) {
        // Es un duplicado
        toDelete.push(docSnapshot.id);
        duplicates++;
      } else {
        seen.add(key);
      }
    });
    
    console.log(`🔍 Duplicados encontrados: ${duplicates}`);
    
    if (duplicates > 0) {
      console.log('🗑️ Eliminando duplicados...');
      
      for (const id of toDelete) {
        await deleteDoc(doc(db, 'mail', id));
        console.log(`✅ Eliminado: ${id}`);
      }
      
      console.log(`🎉 Limpieza completada! Se eliminaron ${duplicates} duplicados.`);
    } else {
      console.log('✅ No se encontraron duplicados para eliminar.');
    }
    
  } catch (error) {
    console.error('❌ Error durante la limpieza:', error);
  }
}

cleanDuplicates();
