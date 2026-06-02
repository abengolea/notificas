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
  serverTimestamp
} from 'firebase/firestore';
import { db } from './firebase';
import { Contacto } from './types';

export function normalizeContactEmail(email: string): string {
  return email.trim().toLowerCase();
}

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
  const normalized = normalizeContactEmail(email);
  if (!normalized.includes('@')) return;

  try {
    // Buscar si ya existe un contacto con este email para este usuario
    const contactosRef = collection(db, 'contactos');
    const q = query(
      contactosRef,
      where('usuarioId', '==', usuarioId),
      where('email', '==', normalized)
    );
    
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      // Crear nuevo contacto
      await addDoc(contactosRef, {
        email: normalized,
        nombre: nombre?.trim() || normalized.split('@')[0],
        cuit: cuit || null,
        telefono: telefono || null,
        usuarioId,
        ultimoUso: serverTimestamp(),
        vecesUsado: 1,
        createdAt: serverTimestamp()
      });
      console.log('✅ Nuevo contacto guardado:', normalized);
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
      console.log('✅ Contacto actualizado:', normalized);
    }
  } catch (error) {
    console.error('❌ Error al guardar contacto:', error);
    // No lanzar error para no interrumpir el envío del mensaje
  }
}

/**
 * Persiste email/teléfono al cargarlos en el formulario de envío.
 * No incrementa vecesUsado (eso ocurre al enviar el mensaje).
 */
export async function persistirContactoDestinatario(
  usuarioId: string,
  email: string,
  telefono?: string
): Promise<void> {
  const normalized = normalizeContactEmail(email);
  if (!normalized.includes('@')) return;

  try {
    const contactosRef = collection(db, 'contactos');
    const q = query(
      contactosRef,
      where('usuarioId', '==', usuarioId),
      where('email', '==', normalized)
    );

    const querySnapshot = await getDocs(q);
    const telefonoVal = telefono?.trim() || null;

    if (querySnapshot.empty) {
      await addDoc(contactosRef, {
        email: normalized,
        nombre: normalized.split('@')[0],
        cuit: null,
        telefono: telefonoVal,
        usuarioId,
        ultimoUso: serverTimestamp(),
        vecesUsado: 0,
        createdAt: serverTimestamp(),
      });
      console.log('✅ Contacto destinatario guardado:', normalized);
    } else if (telefonoVal) {
      const contactoDoc = querySnapshot.docs[0];
      await updateDoc(doc(db, 'contactos', contactoDoc.id), {
        telefono: telefonoVal,
      });
      console.log('✅ Teléfono de contacto actualizado:', normalized);
    }
  } catch (error) {
    console.error('❌ Error al persistir contacto destinatario:', error);
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
    
    const terminoLower = termino.toLowerCase().trim();
    const terminoDigits = termino.replace(/\D/g, '');

    const contactosFiltrados = contactos.filter((contacto) => {
      if (contacto.email.toLowerCase().includes(terminoLower)) return true;
      if (contacto.nombre?.toLowerCase().includes(terminoLower)) return true;
      // Solo filtrar por teléfono si el término incluye dígitos (evita que includes('') coincida con todos)
      if (terminoDigits.length >= 2 && contacto.telefono) {
        return contacto.telefono.replace(/\D/g, '').includes(terminoDigits);
      }
      return false;
    });
    
    return contactosFiltrados.slice(0, limite);
  } catch (error) {
    console.error('❌ Error al buscar contactos:', error);
    return [];
  }
}

/**
 * Actualiza el nombre mostrado de un contacto (el dueño ya está validado por reglas Firestore).
 */
export async function actualizarNombreContacto(contactoId: string, nombre: string): Promise<void> {
  const trimmed = nombre.trim();
  if (trimmed.length < 2) {
    throw new Error('El nombre debe tener al menos 2 caracteres.');
  }
  await updateDoc(doc(db, 'contactos', contactoId), {
    nombre: trimmed,
  });
}
