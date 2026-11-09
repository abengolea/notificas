import { NextResponse, type NextRequest } from 'next/server';
import { clientIp, consumeArtPublicRateLimit } from '@/lib/art/http';

/** Consultas por minuto y por IP al verificador público. Una verificación normal usa muy pocas. */
export const VERIFY_LIMIT_PER_MINUTE = 60;

type Consume = (opts: {
  key: string;
  limit: number;
  windowSeconds?: number;
}) => Promise<{ ok: true } | { ok: false; retryAfter: number }>;

/**
 * Límite por IP para /api/verify, que es público y sin autenticación. Devuelve la respuesta 429 si se excedió, o
 * null si puede seguir. Si el contador falla (por ejemplo Firestore caído) la verificación sigue: un perito no
 * puede quedarse sin verificar por un problema del limitador.
 */
export async function enforceVerifyRateLimit(
  request: NextRequest,
  consume: Consume = consumeArtPublicRateLimit
): Promise<NextResponse | null> {
  try {
    const result = await consume({
      key: `verify_${clientIp(request).replace(/[^a-zA-Z0-9:._-]/g, '_')}`,
      limit: VERIFY_LIMIT_PER_MINUTE,
      windowSeconds: 60,
    });
    if (result.ok) return null;
    return NextResponse.json(
      { error: 'Demasiadas consultas. Probá de nuevo en unos segundos.' },
      { status: 429, headers: { 'Retry-After': String(result.retryAfter) } }
    );
  } catch (e) {
    console.warn('⚠️ Límite de consultas de /api/verify no disponible:', e instanceof Error ? e.message : e);
    return null;
  }
}
