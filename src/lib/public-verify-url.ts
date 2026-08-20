import type { IssuedDocKind } from '@/lib/verify-hints';
import { extractVerifyHints } from '@/lib/verify-hints';

export function publicAppBase(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || 'https://notificas.com.ar').replace(/\/$/, '');
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
