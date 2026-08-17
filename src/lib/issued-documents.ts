import { createHash } from 'crypto';
import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import type { IssuedDocKind } from '@/lib/verify-hints';

export function sha256Hex(data: Buffer | Uint8Array | ArrayBuffer): string {
  const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
  return createHash('sha256').update(buf).digest('hex');
}

export type IssuedDocumentRecord = {
  hash: string;
  kind: IssuedDocKind;
  campaignId?: string;
  orgId?: string;
  orgNombre?: string;
  campaignNombre?: string;
  batchId?: string;
  messageId?: string;
  recipientNombre?: string;
  txHash?: string | null;
  fileName?: string;
};

export async function recordIssuedDocument(
  db: Firestore,
  record: IssuedDocumentRecord
): Promise<void> {
  const hash = record.hash.trim().toLowerCase();
  if (hash.length !== 64) return;
  try {
    await db.collection('issued_documents').doc(hash).set(
      {
        ...record,
        hash,
        createdAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  } catch (e) {
    console.warn('No se pudo registrar el PDF emitido para verificación:', e);
  }
}

export async function findIssuedDocument(
  db: Firestore,
  hash: string
): Promise<IssuedDocumentRecord | null> {
  const snap = await db.collection('issued_documents').doc(hash.trim().toLowerCase()).get();
  if (!snap.exists) return null;
  return snap.data() as IssuedDocumentRecord;
}
