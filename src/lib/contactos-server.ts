import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from './firebase-admin';

export function normalizeContactEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Guarda o actualiza un contacto en Firestore (Admin SDK).
 * Usado tras envíos exitosos desde `/api/sendEmail`.
 */
export async function guardarContactoServer(
  usuarioId: string,
  email: string,
  opts?: { nombre?: string; cuit?: string; telefono?: string }
): Promise<void> {
  const normalized = normalizeContactEmail(email);
  if (!normalized.includes('@')) return;

  try {
    const contactosRef = adminDb.collection('contactos');
    const existing = await contactosRef
      .where('usuarioId', '==', usuarioId)
      .where('email', '==', normalized)
      .limit(1)
      .get();

    if (existing.empty) {
      await contactosRef.add({
        email: normalized,
        nombre: opts?.nombre?.trim() || normalized.split('@')[0],
        cuit: opts?.cuit || null,
        telefono: opts?.telefono || null,
        usuarioId,
        ultimoUso: FieldValue.serverTimestamp(),
        vecesUsado: 1,
        createdAt: FieldValue.serverTimestamp(),
      });
      console.log('✅ Nuevo contacto guardado (server):', normalized);
    } else {
      const contactoDoc = existing.docs[0];
      const data = contactoDoc.data();
      await contactoDoc.ref.update({
        ultimoUso: FieldValue.serverTimestamp(),
        vecesUsado: (data.vecesUsado || 0) + 1,
        ...(opts?.nombre?.trim() && { nombre: opts.nombre.trim() }),
        ...(opts?.cuit && { cuit: opts.cuit }),
        ...(opts?.telefono !== undefined && { telefono: opts.telefono }),
      });
      console.log('✅ Contacto actualizado (server):', normalized);
    }
  } catch (error) {
    console.error('❌ Error al guardar contacto (server):', error);
  }
}

type MailDocForContact = {
  campaignId?: string;
  contactRequest?: boolean;
  createdBy?: string;
  to?: string[];
  recipientEmail?: string;
  recipientName?: string;
  recipientPhone?: string;
};

/** Persiste el destinatario en la libreta personal tras un envío individual (no campaña). */
export async function guardarContactoDesdeMail(mailData: MailDocForContact): Promise<void> {
  if (mailData.campaignId || mailData.contactRequest) return;

  const usuarioId = mailData.createdBy as string | undefined;
  if (!usuarioId) return;

  const rawEmail = Array.isArray(mailData.to)
    ? mailData.to[0]
    : mailData.recipientEmail;
  if (!rawEmail || typeof rawEmail !== 'string') return;

  await guardarContactoServer(usuarioId, rawEmail, {
    nombre: typeof mailData.recipientName === 'string' ? mailData.recipientName : undefined,
    telefono: typeof mailData.recipientPhone === 'string' ? mailData.recipientPhone : undefined,
  });
}
