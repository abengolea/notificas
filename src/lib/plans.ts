import { db } from './firebase';
import { collection, doc, setDoc } from 'firebase/firestore';

export interface Plan {
  id: string;
  nombre: string;
  descripcion: string;
  precio: number;
  creditos: number;
  type: 'unitario' | 'pack' | 'suscripcion';
  activo: boolean;
  orden: number;
}

// Planes por defecto
export const defaultPlans: Plan[] = [
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

// Función para inicializar los planes en Firestore
export async function initializePlans() {
  try {
    const plansRef = collection(db, 'plans');
    
    for (const plan of defaultPlans) {
      const planDoc = doc(plansRef, plan.id);
      await setDoc(planDoc, {
        ...plan,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }
    
    console.log('✅ Planes inicializados en Firestore');
  } catch (error) {
    console.error('❌ Error inicializando planes:', error);
    throw error;
  }
}

// Función para obtener planes desde Firestore
export async function getPlans(): Promise<Plan[]> {
  try {
    const { collection, getDocs, query, where } = await import('firebase/firestore');
    const plansRef = collection(db, 'plans');
    const q = query(
      plansRef,
      where('activo', '==', true)
    );
    
    const querySnapshot = await getDocs(q);
    const plans: Plan[] = [];
    
    querySnapshot.forEach((doc) => {
      plans.push({ id: doc.id, ...doc.data() } as Plan);
    });
    
    // Ordenar localmente por orden
    plans.sort((a, b) => (a.orden || 0) - (b.orden || 0));
    
    return plans;
  } catch (error) {
    console.error('❌ Error obteniendo planes:', error);
    // Retornar planes por defecto si hay error
    return defaultPlans;
  }
}
