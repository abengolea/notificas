const { initializeApp } = require('firebase/app');
const { getFirestore, collection, doc, setDoc } = require('firebase/firestore');

// Configuración de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyCJmjAFcVQMNtTICexEHkzFwgUbGv2zctE",
  authDomain: "notificas-f9953.firebaseapp.com",
  projectId: "notificas-f9953",
  storageBucket: "notificas-f9953.firebasestorage.app",
  messagingSenderId: "367222498482",
  appId: "1:367222498482:web:8d8f95b5d17af1008ad5ab",
  measurementId: "G-TQLEG5ZXGE"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Planes por defecto
const defaultPlans = [
  {
    id: 'individual',
    nombre: 'Individual',
    descripcion: '1 crédito para notificación certificada',
    precio: 500,
    creditos: 1,
    type: 'unitario',
    activo: true,
    orden: 1
  },
  {
    id: 'pack10',
    nombre: 'Pack 10',
    descripcion: '10 créditos con descuento del 20%',
    precio: 4000,
    creditos: 10,
    type: 'pack',
    activo: true,
    orden: 2
  },
  {
    id: 'pack50',
    nombre: 'Pack 50',
    descripcion: '50 créditos con descuento del 30%',
    precio: 17500,
    creditos: 50,
    type: 'pack',
    activo: true,
    orden: 3
  },
  {
    id: 'pack100',
    nombre: 'Pack 100',
    descripcion: '100 créditos con descuento del 40%',
    precio: 30000,
    creditos: 100,
    type: 'pack',
    activo: true,
    orden: 4
  }
];

async function initializePlans() {
  try {
    console.log('🚀 Inicializando planes en Firestore...');
    
    for (const plan of defaultPlans) {
      const planDoc = doc(collection(db, 'plans'), plan.id);
      await setDoc(planDoc, {
        ...plan,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      console.log(`✅ Plan "${plan.nombre}" creado`);
    }
    
    console.log('🎉 Todos los planes han sido inicializados exitosamente');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error inicializando planes:', error);
    process.exit(1);
  }
}

initializePlans();

