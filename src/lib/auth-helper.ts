import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from './firebase-admin';
import type { DecodedIdToken } from 'firebase-admin/auth';

/**
 * Verifica el token de Firebase del header Authorization.
 * Retorna el token decodificado o lanza un NextResponse 401.
 *
 * Uso:
 *   const { decoded, errorResponse } = await verifyAuthToken(request);
 *   if (errorResponse) return errorResponse;
 *   // usar decoded.uid, decoded.email
 */
export async function verifyAuthToken(
  request: NextRequest
): Promise<{ decoded: DecodedIdToken; errorResponse: null } | { decoded: null; errorResponse: NextResponse }> {
  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return {
      decoded: null,
      errorResponse: NextResponse.json({ error: 'No autorizado. Token requerido.' }, { status: 401 }),
    };
  }

  try {
    const decoded = await adminAuth.verifyIdToken(token);
    return { decoded, errorResponse: null };
  } catch {
    return {
      decoded: null,
      errorResponse: NextResponse.json({ error: 'Token inválido o expirado.' }, { status: 401 }),
    };
  }
}
