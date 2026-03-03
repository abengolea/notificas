import { 
  collection, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  limit, 
  getDocs, 
  doc, 
  updateDoc, 
  serverTimestamp,
  getDoc
} from 'firebase/firestore';
import { db } from './firebase';
import { Contacto } from './types';

/**
 * Guarda o actualiza un contacto cuando se envía un mensaje
 */
export async function guardarContacto(
  usuarioId: string, 
  email: string, 
  nombre?: string,
  cuit?: string,
  telefono?: string
): Promise<void> {
  try {
    // Buscar si ya existe un contacto con este email para este usuario
    const contactosRef = collection(db, 'contactos');
    const q = query(
      contactosRef,
      where('usuarioId', '==', usuarioId),
      where('email', '==', email)
    );
    
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      // Crear nuevo contacto
      await addDoc(contactosRef, {
        email,
        nombre: nombre || email.split('@')[0], // Usar parte antes del @ como nombre por defecto
        cuit: cuit || null,
        telefono: telefono || null,
        usuarioId,
        ultimoUso: serverTimestamp(),
        vecesUsado: 1,
        createdAt: serverTimestamp()
      });
      console.log('✅ Nuevo contacto guardado:', email);
    } else {
      // Actualizar contacto existente
      const contactoDoc = querySnapshot.docs[0];
      await updateDoc(doc(db, 'contactos', contactoDoc.id), {
        ultimoUso: serverTimestamp(),
        vecesUsado: (contactoDoc.data().vecesUsado || 0) + 1,
        ...(nombre && { nombre }), // Actualizar nombre si se proporciona
        ...(cuit && { cuit }), // Actualizar CUIT si se proporciona
        ...(telefono !== undefined && { telefono }) // Actualizar teléfono si se proporciona
      });
      console.log('✅ Contacto actualizado:', email);
    }
  } catch (error) {
    console.error('❌ Error al guardar contacto:', error);
    // No lanzar error para no interrumpir el envío del mensaje
  }
}

/**
 * Obtiene los contactos más usados de un usuario para autocompletado
 */
export async function obtenerContactos(
  usuarioId: string, 
  limite: number = 10
): Promise<Contacto[]> {
  try {
    const contactosRef = collection(db, 'contactos');
    const q = query(
      contactosRef,
      where('usuarioId', '==', usuarioId),
      orderBy('vecesUsado', 'desc'),
      orderBy('ultimoUso', 'desc'),
      limit(limite)
    );
    
    const querySnapshot = await getDocs(q);
    const contactos: Contacto[] = [];
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      contactos.push({
        id: doc.id,
        email: data.email,
        nombre: data.nombre,
        cuit: data.cuit,
        telefono: data.telefono,
        usuarioId: data.usuarioId,
        ultimoUso: data.ultimoUso?.toDate() || new Date(),
        vecesUsado: data.vecesUsado || 0,
        createdAt: data.createdAt?.toDate() || new Date()
      });
    });
    
    return contactos;
  } catch (error) {
    console.error('❌ Error al obtener contactos:', error);
    return [];
  }
}

/**
 * Busca contactos que coincidan con un término de búsqueda
 */
export async function buscarContactos(
  usuarioId: string, 
  termino: string, 
  limite: number = 5
): Promise<Contacto[]> {
  try {
    const contactos = await obtenerContactos(usuarioId, 50); // Obtener más para filtrar
    
    // Filtrar por término de búsqueda (email o nombre)
    const terminoLower = termino.toLowerCase();
    const contactosFiltrados = contactos.filter(contacto => 
      contacto.email.toLowerCase().includes(terminoLower) ||
      (contacto.nombre && contacto.nombre.toLowerCase().includes(terminoLower))
    );
    
    return contactosFiltrados.slice(0, limite);
  } catch (error) {
    console.error('❌ Error al buscar contactos:', error);
    return [];
  }
}
