import type { NextRequest } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';
import type { MailViewer } from '@/lib/mail-sender';

/**
 * Identidad Firebase del que llama, si mandó `Authorization: Bearer <idToken>`.
 * Es solo una PISTA para reconocer al remitente: un token ausente o inválido devuelve `null`
 * y no rompe el flujo del destinatario (que se autentica con `k`).
 */
export async function getOptionalViewer(request: NextRequest): Promise<MailViewer | null> {
  const header = request.headers.get('Authorization');
  const bearer = header?.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!bearer) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(bearer);
    return { uid: decoded.uid, email: typeof decoded.email === 'string' ? decoded.email : '' };
  } catch {
    return null;
  }
}
