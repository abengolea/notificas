import { sha256Hex } from '@/lib/merkle';

export class LotePdfIntegrityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LotePdfIntegrityError';
  }
}

const SHA256_HEX = /^[a-f0-9]{64}$/;

/** SHA-256 hex de 64 caracteres. No se trunca, no se rellena, no se completa. */
export function asLeafHash(raw: string | undefined, label: string): string {
  const h = String(raw || '').trim().toLowerCase();
  if (h.length !== 64 || !SHA256_HEX.test(h)) {
    throw new LotePdfIntegrityError(
      `${label}: el hash de hoja debe ser exactamente 64 caracteres hexadecimales. No se completa ni se trunca.`
    );
  }
  return h;
}

/** Igual que computeLeavesDigest: SHA-256(JSON.stringify(hashes.sort())). */
export async function digestOfLeafHashes(hashes: string[]): Promise<string> {
  return sha256Hex(JSON.stringify([...hashes].sort()));
}

export function extractLeavesDigestFromPayload(payload: string | null | undefined): string | null {
  if (!payload) return null;
  const parts = payload.split('|');
  if (parts[0] !== 'CAMPAIGN_SEND' && parts[0] !== 'CAMPAIGN_EVENT') return null;
  if (parts[1] !== 'v2') return null;
  const digest = (parts[7] || '').trim().toLowerCase();
  return SHA256_HEX.test(digest) ? digest : null;
}

export async function assertPrintedLoteIntegrity(input: {
  payload?: string;
  leaves: Array<{ leafHash?: string }>;
}): Promise<{ hashes: string[]; computedDigest: string; payloadDigest: string | null }> {
  if (!input.leaves.length) {
    throw new LotePdfIntegrityError('El lote no tiene hojas para imprimir.');
  }
  const hashes = input.leaves.map((leaf, i) => asLeafHash(leaf.leafHash, `hoja ${i}`));
  const computedDigest = await digestOfLeafHashes(hashes);
  const payload = input.payload || '';
  const parts = payload ? payload.split('|') : [];
  const isV2 = parts[1] === 'v2';
  const payloadDigest = extractLeavesDigestFromPayload(payload || null);
  if (isV2 && !payloadDigest) {
    throw new LotePdfIntegrityError('Payload v2 sin leavesDigest de 64 hex. No se genera el PDF.');
  }
  if (payloadDigest && payloadDigest !== computedDigest) {
    throw new LotePdfIntegrityError(
      'leavesDigest del payload no coincide con las hojas que se iban a imprimir. No se genera el PDF.'
    );
  }
  return { hashes, computedDigest, payloadDigest };
}
