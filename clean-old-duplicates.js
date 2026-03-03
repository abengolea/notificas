// Script simple para limpiar duplicados viejos
// Solo elimina correos con from: 'abengolea1@gmail.com' que son duplicados

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, deleteDoc, doc, query, where } = require('firebase/firestore');

// Configuración de Firebase
const firebaseConfig = {
  // Usar las variables de entorno del proyecto
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

async function cleanDuplicates() {
  try {
    console.log('🧹 Iniciando limpieza de duplicados viejos...');
    
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    
    // Obtener todos los correos con from: 'abengolea1@gmail.com' (duplicados)
    const q = query(collection(db, 'mail'), where('from', '==', 'abengolea1@gmail.com'));
    const snapshot = await getDocs(q);
    
    console.log(`📊 Encontrados ${snapshot.size} correos duplicados para eliminar`);
    
    if (snapshot.size > 0) {
      console.log('🗑️ Eliminando duplicados...');
      
      const deletePromises = [];
      snapshot.forEach((docSnapshot) => {
        deletePromises.push(deleteDoc(doc(db, 'mail', docSnapshot.id)));
      });
      
      await Promise.all(deletePromises);
      console.log(`✅ Se eliminaron ${snapshot.size} correos duplicados`);
    } else {
      console.log('✅ No se encontraron duplicados para eliminar');
    }
    
  } catch (error) {
    console.error('❌ Error durante la limpieza:', error);
  }
}

cleanDuplicates();
