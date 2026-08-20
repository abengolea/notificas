import type { IssuedDocKind } from '@/lib/verify-hints';
import { extractVerifyHints } from '@/lib/verify-hints';

/** Destino del QR: el teléfono no puede abrir localhost. */
export const PUBLIC_VERIFY_ORIGIN = 'https://notificas.com.ar';

function isPublicHttpsOrigin(raw: string): boolean {
  try {
    const u = new URL(raw);
    if (u.protocol !== 'https:') return false;
    const host = u.hostname.toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1' || host.endsWith('.local')) {
      return false;
    }
    if (/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(host)) return false;
    return Boolean(host);
  } catch {
    return false;
  }
}

/** Base pública para QR y enlaces de validación (nunca localhost). */
export function publicAppBase(): string {
  const candidates = [
    process.env.NEXT_PUBLIC_VERIFY_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    PUBLIC_VERIFY_ORIGIN,
  ];
  for (const raw of candidates) {
    const base = (raw || '').trim().replace(/\/$/, '');
    if (base && isPublicHttpsOrigin(base)) return base;
  }
  return PUBLIC_VERIFY_ORIGIN;
}

/** URL pública del validador. El QR del PDF debe apuntar acá, no a Polygonscan. */
export function publicCertificateVerifyUrl(q: {
  id?: string;
  campaignId?: string;
  batchId?: string;
  kind?: IssuedDocKind;
}): string {
  const base = publicAppBase();
  const params = new URLSearchParams();
  if (q.id) params.set('id', q.id);
  if (q.campaignId) params.set('campaignId', q.campaignId);
  if (q.batchId) params.set('batchId', q.batchId);
  if (q.kind) params.set('kind', q.kind);
  const qs = params.toString();
  return qs ? `${base}/verify?${qs}` : `${base}/verify`;
}

export function verifyQueryFromSearchParams(search: URLSearchParams): {
  id?: string;
  campaignId?: string;
  batchId?: string;
  kind?: IssuedDocKind;
} {
  const ref = (search.get('ref') || '').trim();
  const fromRef = ref ? extractVerifyHints(`verify-ref: ${ref}`) : {};
  const id = (search.get('id') || search.get('messageId') || fromRef.messageId || '').trim();
  const campaignId = (search.get('campaignId') || fromRef.campaignId || '').trim();
  const batchId = (search.get('batchId') || fromRef.batchId || '').trim();
  const kindRaw = (search.get('kind') || fromRef.kind || '').trim();
  const kind = (kindRaw || undefined) as IssuedDocKind | undefined;
  return {
    id: id || undefined,
    campaignId: campaignId || undefined,
    batchId: batchId || undefined,
    kind,
  };
}
