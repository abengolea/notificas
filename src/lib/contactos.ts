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
  telefono?: string,
  empresa?: string
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
        empresa: empresa?.trim() || null,
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
        ...(empresa !== undefined && { empresa: empresa?.trim() || null }),
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
        empresa: null,
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
        empresa: data.empresa,
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
export function filtrarContactos(contactos: Contacto[], termino: string): Contacto[] {
  const terminoLower = termino.toLowerCase().trim();
  if (!terminoLower) return contactos;

  const terminoDigits = termino.replace(/\D/g, '');

  return contactos.filter((contacto) => {
    if (contacto.email.toLowerCase().includes(terminoLower)) return true;
    if (contacto.nombre?.toLowerCase().includes(terminoLower)) return true;
    if (contacto.empresa?.toLowerCase().includes(terminoLower)) return true;
    if (terminoDigits.length >= 2 && contacto.telefono) {
      return contacto.telefono.replace(/\D/g, '').includes(terminoDigits);
    }
    return false;
  });
}

/**
 * Busca contactos que coincidan con un término de búsqueda (consulta remota)
 */
export async function buscarContactos(
  usuarioId: string, 
  termino: string, 
  limite: number = 5
): Promise<Contacto[]> {
  try {
    const contactos = await obtenerContactos(usuarioId, 50); // Obtener más para filtrar
    
    const contactosFiltrados = filtrarContactos(contactos, termino);
    
    return contactosFiltrados.slice(0, limite);
  } catch (error) {
    console.error('❌ Error al buscar contactos:', error);
    return [];
  }
}

/**
 * Actualiza datos editables de un contacto (el dueño ya está validado por reglas Firestore).
 */
export async function actualizarContacto(
  contactoId: string,
  datos: { nombre?: string; empresa?: string }
): Promise<void> {
  const update: Record<string, string | null> = {};

  if (datos.nombre !== undefined) {
    const trimmed = datos.nombre.trim();
    if (trimmed.length < 2) {
      throw new Error('El nombre debe tener al menos 2 caracteres.');
    }
    update.nombre = trimmed;
  }

  if (datos.empresa !== undefined) {
    update.empresa = datos.empresa.trim() || null;
  }

  if (Object.keys(update).length === 0) return;

  await updateDoc(doc(db, 'contactos', contactoId), update);
}

/** @deprecated Usar actualizarContacto */
export async function actualizarNombreContacto(contactoId: string, nombre: string): Promise<void> {
  await actualizarContacto(contactoId, { nombre });
}

/** Lista única de empresas ya usadas en la agenda (orden alfabético). */
export function extraerEmpresasUnicas(contactos: Contacto[]): string[] {
  const seen = new Set<string>();
  const empresas: string[] = [];
  for (const c of contactos) {
    const e = c.empresa?.trim();
    if (!e) continue;
    const key = e.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    empresas.push(e);
  }
  return empresas.sort((a, b) => a.localeCompare(b, 'es'));
}

export type GrupoContactos = {
  empresa: string | null;
  contactos: Contacto[];
};

/** Agrupa contactos por empresa; "sin empresa" al final. */
export function agruparContactosPorEmpresa(contactos: Contacto[]): GrupoContactos[] {
  const porEmpresa = new Map<string, Contacto[]>();
  const sinEmpresa: Contacto[] = [];

  for (const c of contactos) {
    const e = c.empresa?.trim();
    if (!e) {
      sinEmpresa.push(c);
      continue;
    }
    const key = e.toLowerCase();
    const lista = porEmpresa.get(key) ?? [];
    lista.push(c);
    porEmpresa.set(key, lista);
  }

  const sortContactos = (a: Contacto, b: Contacto) =>
    (a.nombre || a.email).localeCompare(b.nombre || b.email, 'es');

  const grupos: GrupoContactos[] = [...porEmpresa.entries()]
    .sort(([a], [b]) => a.localeCompare(b, 'es'))
    .map(([, lista]) => {
      lista.sort(sortContactos);
      return { empresa: lista[0].empresa!.trim(), contactos: lista };
    });

  if (sinEmpresa.length > 0) {
    sinEmpresa.sort(sortContactos);
    grupos.push({ empresa: null, contactos: sinEmpresa });
  }

  return grupos;
}
