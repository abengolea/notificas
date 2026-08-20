import { createHash } from 'crypto';
import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import type { IssuedDocKind } from '@/lib/verify-hints';

export function sha256Hex(data: Buffer | Uint8Array | ArrayBuffer): string {
  const bytes = data instanceof ArrayBuffer ? new Uint8Array(data) : data;
  return createHash('sha256').update(bytes).digest('hex');
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
  createdAt?: unknown;
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

export async function findLatestIssuedByCampaign(
  db: Firestore,
  campaignId: string,
  kind: IssuedDocKind
): Promise<IssuedDocumentRecord | null> {
  try {
    const snap = await db
      .collection('issued_documents')
      .where('campaignId', '==', campaignId)
      .limit(40)
      .get();
    const rows = snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as IssuedDocumentRecord) }))
      .filter((r) => r.kind === kind && r.hash);
    if (!rows.length) return null;
    rows.sort((a, b) => {
      const ta = a.createdAt && typeof a.createdAt === 'object' && 'toMillis' in a.createdAt
        ? Number((a.createdAt as { toMillis: () => number }).toMillis())
        : 0;
      const tb = b.createdAt && typeof b.createdAt === 'object' && 'toMillis' in b.createdAt
        ? Number((b.createdAt as { toMillis: () => number }).toMillis())
        : 0;
      return tb - ta;
    });
    return rows[0];
  } catch {
    return null;
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

