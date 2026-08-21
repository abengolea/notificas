import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase-admin';
import { sendPolygonTransaction } from '@/lib/blockchain';
import { buildMerkleTree, getMerkleProof, sha256Hex, verifyMerkleProof } from '@/lib/merkle';
import {
  buildSendLeafPayload,
  buildEventLeafPayload,
  type EventLeafMetaEvidence,
} from '@/lib/campaign-leaf-payload';
import { enqueueIntegrityClose } from '@/lib/cloud-tasks';

export {
  buildSendLeafPayload,
  parseSendLeafPayload,
  buildEventLeafPayload,
  parseEventLeafPayload,
} from '@/lib/campaign-leaf-payload';
export type { EventLeafMetaEvidence } from '@/lib/campaign-leaf-payload';

export const SEND_TANDA_SIZE = 500;
export const EVENT_TANDA_SIZE = 500;
/** Sin hojas nuevas en este plazo → se lacre el resto (aunque no llegue a 500). */
export const IDLE_CLOSE_DELAY_SEC = 6 * 60 * 60;
export const SEND_CLOSE_DELAY_SEC = IDLE_CLOSE_DELAY_SEC;
export const EVENT_CLOSE_DELAY_SEC = IDLE_CLOSE_DELAY_SEC;
/** Versión del payload on-chain. v1 no tenía leavesDigest; v2 lo pone en posición 7. El prefijo sigue siendo CAMPAIGN_SEND / CAMPAIGN_EVENT. */
export const ONCHAIN_PAYLOAD_VERSION = 'v2';

export type IntegrityKind = 'send' | 'event';
export type IntegrityEventType = 'email_read' | 'wa_delivered' | 'wa_read';

export type IntegrityBatch = {
  id: string;
  campaignId: string;
  orgId: string;
  kind: IntegrityKind;
  tandaIndex?: number;
  dayKey?: string;
  status: 'open' | 'sealing' | 'anchored' | 'failed' | 'empty';
  accepting: boolean;
  expectedCount: number;
  sealedCount: number;
  leafCount: number;
  lastLeafAt?: unknown;
  merkleRoot?: string;
  txHash?: string;
  payload?: string;
  leavesDigest?: string;
  templateSealHash?: string;
  errorMsg?: string;
  createdAt?: unknown;
  sealedAt?: unknown;
};

function batchesCol(campaignId: string) {
  return getAdminDb().collection('campaigns').doc(campaignId).collection('integrity_batches');
}

export function sendBatchId(tandaIndex: number): string {
  return `send-${tandaIndex}`;
}

export function eventDayKey(at = new Date()): string {
  return at.toISOString().slice(0, 10);
}

/** Lote 1 del día: events-YYYY-MM-DD. Si ese se lacró, events-YYYY-MM-DD-2, -3, … */
export function eventBatchId(at = new Date(), seq = 1): string {
  const day = eventDayKey(at);
  return seq <= 1 ? `events-${day}` : `events-${day}-${seq}`;
}

export function tandaIndexFromOffset(offset: number): number {
  return Math.floor(Math.max(0, offset) / SEND_TANDA_SIZE);
}

/** Id de tanda abierta para este índice. Si la original ya se lacró, propone una nueva. */
export async function resolveOpenSendBatchId(campaignId: string, tandaIndex: number): Promise<string> {
  const batchId = sendBatchId(tandaIndex);
  const primary = await batchesCol(campaignId).doc(batchId).get();
  if (primary.exists && primary.data()?.status !== 'open') {
    return `${batchId}-${Date.now()}`;
  }
  return batchId;
}

/** Sobre de hechos del día que todavía acepta hojas. Si el de 500 ya se lacró, abre el siguiente. */
export async function resolveOpenEventBatchId(campaignId: string, at = new Date()): Promise<string> {
  const col = batchesCol(campaignId);
  for (let seq = 1; seq <= 400; seq++) {
    const id = eventBatchId(at, seq);
    const snap = await col.doc(id).get();
    if (!snap.exists || snap.data()?.status === 'open') return id;
  }
  return `events-${eventDayKey(at)}-${Date.now()}`;
}

function isCampaignOnChainPrefix(prefix: string | undefined): boolean {
  return prefix === 'CAMPAIGN_SEND' || prefix === 'CAMPAIGN_EVENT';
}

function timestampMs(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (v instanceof Date) return v.getTime();
  if (typeof v === 'object') {
    const o = v as { toMillis?: () => number; _seconds?: number; seconds?: number };
    if (typeof o.toMillis === 'function') return o.toMillis();
    const secs = o._seconds ?? o.seconds;
    if (typeof secs === 'number') return secs * 1000;
  }
  return 0;
}

/** Segundos que faltan para el cierre por inactividad. 0 = ya se puede lacrar. */
export function idleCloseRemainingSec(data: { lastLeafAt?: unknown; createdAt?: unknown }): number {
  const last = timestampMs(data.lastLeafAt) || timestampMs(data.createdAt);
  if (!last) return IDLE_CLOSE_DELAY_SEC;
  const elapsed = Math.max(0, Math.floor((Date.now() - last) / 1000));
  return Math.max(0, IDLE_CLOSE_DELAY_SEC - elapsed);
}

export function extractMerkleRootFromPayload(payload: string | null): string | null {
  if (!payload) return null;
  const parts = payload.split('|');
  if (!isCampaignOnChainPrefix(parts[0])) return null;
  const root = parts[4]?.trim();
  return root && root.length === 64 ? root : null;
}

/**
 * Digest de hojas (SHA-256 del JSON de leafHashes ordenados).
 * Solo existe en payloads v2. En v1 la posición 7 puede ser templateSealHash: no se lee como digest.
 */
export function extractLeavesDigestFromPayload(payload: string | null): string | null {
  if (!payload) return null;
  const parts = payload.split('|');
  if (!isCampaignOnChainPrefix(parts[0])) return null;
  if (parts[1] !== ONCHAIN_PAYLOAD_VERSION) return null;
  const digest = parts[7]?.trim();
  return digest && digest.length === 64 ? digest : null;
}

/** SHA-256(JSON.stringify(hashes.sort())) — determinista para un perito (JSON compacto, sort UTF-16). */
export async function computeLeavesDigest(leafHashes: string[]): Promise<string> {
  const sortedHashes = [...leafHashes].sort();
  return sha256Hex(JSON.stringify(sortedHashes));
}

/** Crea o agranda la tanda de envío. Si la tanda ya se lacró, abre otra (no se reabre el sobre). */
export async function ensureSendBatch(params: {
  campaignId: string;
  orgId: string;
  tandaIndex: number;
  expectedIncrement: number;
  batchId?: string;
}): Promise<string> {
  const { campaignId, orgId, tandaIndex, expectedIncrement } = params;
  const db = getAdminDb();
  const batchId = params.batchId || (await resolveOpenSendBatchId(campaignId, tandaIndex));
  const ref = batchesCol(campaignId).doc(batchId);

  await db.runTransaction(async (t) => {
    const snap = await t.get(ref);
    if (!snap.exists) {
      t.set(ref, {
        campaignId,
        orgId,
        kind: 'send',
        tandaIndex,
        status: 'open',
        accepting: true,
        expectedCount: expectedIncrement,
        sealedCount: 0,
        leafCount: 0,
        createdAt: FieldValue.serverTimestamp(),
        lastLeafAt: FieldValue.serverTimestamp(),
      });
    } else if (snap.data()?.status === 'open') {
      t.update(ref, {
        expectedCount: FieldValue.increment(expectedIncrement),
        accepting: true,
      });
    }
  });

  if (tandaIndex > 0) {
    const prev = batchesCol(campaignId).doc(sendBatchId(tandaIndex - 1));
    const prevSnap = await prev.get();
    if (prevSnap.exists && prevSnap.data()?.accepting !== false) {
      await prev.update({ accepting: false }).catch(() => undefined);
    }
  }

  if (expectedIncrement > 0) {
    void enqueueIntegrityClose(campaignId, batchId, SEND_CLOSE_DELAY_SEC).catch((e) =>
      console.warn('⚠️ No se pudo encolar cierre de tanda envío:', e?.message)
    );
  }

  return batchId;
}

export async function recordSendLeaf(params: {
  campaignId: string;
  orgId: string;
  messageId: string;
  batchId: string;
  email: string;
  phone: string;
  contentHash: string;
  attachmentHashes: string[];
  smtpMessageId?: string;
  wamid?: string;
  waBodyHash?: string;
  templateSealHash?: string;
  waVars?: Record<string, string>;
  dni?: string;
  nombre?: string;
  monto?: string;
  cuotas?: string;
  rowHash?: string;
}): Promise<{ leafHash: string; already: boolean }> {
  const db = getAdminDb();
  const msgRef = db.collection('campaign_messages').doc(params.messageId);
  const batchRef = batchesCol(params.campaignId).doc(params.batchId);
  const leafRef = batchRef.collection('leaves').doc(params.messageId);

  const leafPayload = buildSendLeafPayload({
    campaignId: params.campaignId,
    messageId: params.messageId,
    email: params.email,
    phone: params.phone,
    contentHash: params.contentHash,
    attachmentHashes: params.attachmentHashes,
    smtpMessageId: params.smtpMessageId || '',
    wamid: params.wamid || '',
    waBodyHash: params.waBodyHash || '',
    templateSealHash: params.templateSealHash || '',
    dni: params.dni || '',
    nombre: params.nombre || '',
    monto: params.monto || '',
    cuotas: params.cuotas || '',
    rowHash: params.rowHash || '',
  });
  const leafHash = await sha256Hex(leafPayload);

  const result = await db.runTransaction(async (t) => {
    const msgSnap = await t.get(msgRef);
    const msg = msgSnap.data();
    if (!msg) throw new Error('campaign_message no encontrado');
    if (msg.integritySendSealed) return { already: true as const };

    const batchSnap = await t.get(batchRef);
    if (!batchSnap.exists) {
      t.set(batchRef, {
        campaignId: params.campaignId,
        orgId: params.orgId,
        kind: 'send',
        status: 'open',
        accepting: true,
        expectedCount: 1,
        sealedCount: 1,
        leafCount: 1,
        createdAt: FieldValue.serverTimestamp(),
        lastLeafAt: FieldValue.serverTimestamp(),
      });
    } else {
      t.update(batchRef, {
        leafCount: FieldValue.increment(1),
        sealedCount: FieldValue.increment(1),
        lastLeafAt: FieldValue.serverTimestamp(),
      });
    }

    t.set(leafRef, {
      kind: 'send',
      messageId: params.messageId,
      leafPayload,
      leafHash,
      contentHash: params.contentHash,
      waBodyHash: params.waBodyHash || null,
      templateSealHash: params.templateSealHash || null,
      waVars: params.waVars || null,
      dni: params.dni || null,
      nombre: params.nombre || null,
      monto: params.monto || null,
      cuotas: params.cuotas || null,
      rowHash: params.rowHash || null,
      createdAt: FieldValue.serverTimestamp(),
    });
    t.update(msgRef, {
      integritySendSealed: true,
      integritySendBatchId: params.batchId,
      'integrity.send': {
        batchId: params.batchId,
        leafHash,
        contentHash: params.contentHash,
        smtpMessageId: params.smtpMessageId || null,
        wamid: params.wamid || null,
        waBodyHash: params.waBodyHash || null,
        templateSealHash: params.templateSealHash || null,
        waVars: params.waVars || null,
        dni: params.dni || null,
        nombre: params.nombre || null,
        monto: params.monto || null,
        cuotas: params.cuotas || null,
        rowHash: params.rowHash || null,
      },
    });
    return { already: false as const };
  });

  if (!result.already) {
    await maybeEnqueueClose(params.campaignId, params.batchId, 'send');
  }

  return { leafHash, already: result.already };
}

export function buildErrorLeafPayload(input: {
  campaignId: string;
  messageId: string;
  email: string;
  phone: string;
  contentHash: string;
  errorCode: string;
  occurredAt: string;
}): string {
  return [
    'v2',
    'error',
    input.campaignId,
    input.messageId,
    (input.email || '').trim().toLowerCase().replace(/\|/g, '_'),
    (input.phone || '').replace(/\D/g, ''),
    input.contentHash || '',
    (input.errorCode || 'unknown').replace(/\|/g, '_'),
    input.occurredAt,
  ].join('|');
}

/** Destinatario que falló: crea hoja de error en el árbol para que todo destinatario procesado tenga prueba. */
export async function recordSendError(params: {
  campaignId: string;
  orgId?: string;
  messageId: string;
  batchId: string;
  errorCode?: string;
  email?: string;
  phone?: string;
  contentHash?: string;
}): Promise<void> {
  const db = getAdminDb();
  const msgRef = db.collection('campaign_messages').doc(params.messageId);
  const batchRef = batchesCol(params.campaignId).doc(params.batchId);
  const leafRef = batchRef.collection('leaves').doc(params.messageId);

  const added = await db.runTransaction(async (t) => {
    const msgSnap = await t.get(msgRef);
    const msg = msgSnap.data();
    if (!msg || msg.integritySendSealed) return false;
    const batchSnap = await t.get(batchRef);
    if (!batchSnap.exists) return false;

    const email = (params.email ?? String(msg.recipientEmail || '')).trim().toLowerCase();
    const phone = String(params.phone ?? msg.recipientTelefono ?? '').replace(/\D/g, '');
    const contentHash = String(
      params.contentHash || msg.integrity?.send?.contentHash || msg.contentHash || ''
    );
    const errorCode = (params.errorCode || 'unknown').slice(0, 64);
    const occurredAt = new Date().toISOString();
    const leafPayload = buildErrorLeafPayload({
      campaignId: params.campaignId,
      messageId: params.messageId,
      email,
      phone,
      contentHash,
      errorCode,
      occurredAt,
    });
    const leafHash = await sha256Hex(leafPayload);

    t.set(leafRef, {
      kind: 'error',
      messageId: params.messageId,
      leafPayload,
      leafHash,
      errorCode,
      occurredAt,
      email,
      phone,
      contentHash: contentHash || null,
      createdAt: FieldValue.serverTimestamp(),
    });
    t.update(msgRef, {
      integritySendSealed: true,
      integritySendBatchId: params.batchId,
      'integrity.send': {
        batchId: params.batchId,
        leafHash,
        errorCode,
        contentHash: contentHash || null,
      },
    });
    t.update(batchRef, {
      sealedCount: FieldValue.increment(1),
      leafCount: FieldValue.increment(1),
      lastLeafAt: FieldValue.serverTimestamp(),
    });
    return true;
  });

  if (added) {
    await maybeEnqueueClose(params.campaignId, params.batchId, 'send');
  }
}

export async function recordEventLeaf(params: {
  campaignId: string;
  orgId: string;
  messageId: string;
  eventType: IntegrityEventType;
  occurredAt?: string;
  meta?: EventLeafMetaEvidence;
}): Promise<{ leafHash: string; already: boolean; batchId: string }> {
  const db = getAdminDb();
  const occurredAt = params.occurredAt || new Date().toISOString();
  const at = new Date(occurredAt);
  const dayKey = eventDayKey(Number.isNaN(at.getTime()) ? new Date() : at);
  const leafId = `${params.messageId}_${params.eventType}`;
  const msgRef = db.collection('campaign_messages').doc(params.messageId);

  const msgSnap = await msgRef.get();
  const msg = msgSnap.data();
  const sendLeafHash = String(msg?.integrity?.send?.leafHash || '');

  const leafPayload = buildEventLeafPayload({
    campaignId: params.campaignId,
    messageId: params.messageId,
    eventType: params.eventType,
    occurredAt,
    sendLeafHash,
    meta: params.meta,
  });
  const leafHash = await sha256Hex(leafPayload);

  let batchId = await resolveOpenEventBatchId(params.campaignId, Number.isNaN(at.getTime()) ? new Date() : at);
  let already = false;

  for (let attempt = 0; attempt < 8; attempt++) {
    const batchRef = batchesCol(params.campaignId).doc(batchId);
    const leafRef = batchRef.collection('leaves').doc(leafId);

    const outcome = await db.runTransaction(async (t) => {
      const msgT = await t.get(msgRef);
      const msgNow = msgT.data();
      if (msgNow?.integrity?.events?.[params.eventType]?.leafHash) {
        return 'already' as const;
      }

      const existing = await t.get(leafRef);
      if (existing.exists) return 'already' as const;

      const batchSnap = await t.get(batchRef);
      const st = batchSnap.exists ? String(batchSnap.data()?.status || '') : 'open';
      if (batchSnap.exists && st !== 'open') return 'sealed' as const;

      if (!batchSnap.exists) {
        t.set(batchRef, {
          campaignId: params.campaignId,
          orgId: params.orgId || String(msgNow?.orgId || msg?.orgId || ''),
          kind: 'event',
          dayKey,
          status: 'open',
          accepting: true,
          expectedCount: 0,
          sealedCount: 0,
          leafCount: 1,
          createdAt: FieldValue.serverTimestamp(),
          lastLeafAt: FieldValue.serverTimestamp(),
        });
      } else {
        t.update(batchRef, {
          leafCount: FieldValue.increment(1),
          lastLeafAt: FieldValue.serverTimestamp(),
        });
      }

      t.set(leafRef, {
        kind: 'event',
        eventType: params.eventType,
        messageId: params.messageId,
        occurredAt,
        sendLeafHash,
        leafPayload,
        leafHash,
        createdAt: FieldValue.serverTimestamp(),
      });
      t.update(msgRef, {
        [`integrity.events.${params.eventType}`]: {
          batchId,
          leafHash,
          occurredAt,
        },
      });
      return 'ok' as const;
    });

    if (outcome === 'already') {
      already = true;
      break;
    }
    if (outcome === 'sealed') {
      batchId = await resolveOpenEventBatchId(
        params.campaignId,
        Number.isNaN(at.getTime()) ? new Date() : at
      );
      continue;
    }
    already = false;
    break;
  }

  if (!already) {
    const batchRef = batchesCol(params.campaignId).doc(batchId);
    if ((await batchRef.get()).data()?.leafCount === 1) {
      void enqueueIntegrityClose(params.campaignId, batchId, EVENT_CLOSE_DELAY_SEC).catch((e) =>
        console.warn('⚠️ No se pudo encolar cierre de tanda de hechos:', e?.message)
      );
    }
    await maybeEnqueueClose(params.campaignId, batchId, 'event');
  }

  return { leafHash, already, batchId };
}

async function maybeEnqueueClose(
  campaignId: string,
  batchId: string,
  kind: IntegrityKind
): Promise<void> {
  const snap = await batchesCol(campaignId).doc(batchId).get();
  const d = snap.data();
  if (!d || d.status !== 'open') return;

  const ready =
    kind === 'send'
      ? d.leafCount > 0 &&
        ((d.sealedCount >= SEND_TANDA_SIZE) ||
          (d.sealedCount >= d.expectedCount && d.expectedCount > 0 && d.accepting === false))
      : d.leafCount >= EVENT_TANDA_SIZE;

  if (ready) {
    void enqueueIntegrityClose(campaignId, batchId, 0).catch((e) =>
      console.warn('⚠️ No se pudo encolar cierre inmediato:', e?.message)
    );
  }
}

export async function closeOpenBatches(campaignId: string, force = false): Promise<string[]> {
  const snap = await batchesCol(campaignId).where('status', '==', 'open').get();
  const closed: string[] = [];
  for (const doc of snap.docs) {
    const res = await closeIntegrityBatch(campaignId, doc.id, { force });
    if (res.status === 'anchored' || res.status === 'empty') closed.push(doc.id);
  }
  return closed;
}

export async function closeIntegrityBatch(
  campaignId: string,
  batchId: string,
  opts: { force?: boolean; idle?: boolean } = {}
): Promise<{
  status: string;
  txHash?: string;
  merkleRoot?: string;
  leafCount?: number;
  error?: string;
  leavesDigest?: string;
  deferredSec?: number;
}> {
  const db = getAdminDb();
  const batchRef = batchesCol(campaignId).doc(batchId);

  const claimed = await db.runTransaction(async (t) => {
    const snap = await t.get(batchRef);
    if (!snap.exists) throw new Error('Tanda no encontrada');
    const d = snap.data()!;
    if (d.status === 'anchored') return { skip: true as const, data: d };
    if (d.status === 'sealing') return { skip: true as const, data: d };
    if (d.status !== 'open') return { skip: true as const, data: d };

    const remaining = idleCloseRemainingSec(d);
    if (opts.idle && !opts.force && remaining > 0 && Number(d.leafCount || 0) > 0) {
      return { skip: true as const, data: d, deferSec: Math.max(60, remaining) };
    }

    const idleReady = Boolean(opts.idle) && remaining <= 0 && Number(d.leafCount || 0) > 0;

    const ready =
      opts.force ||
      idleReady ||
      (d.kind === 'send' &&
        d.leafCount > 0 &&
        (d.sealedCount >= SEND_TANDA_SIZE ||
          (d.sealedCount >= d.expectedCount && d.expectedCount > 0 && d.accepting === false))) ||
      (d.kind === 'event' && d.leafCount >= EVENT_TANDA_SIZE);

    if (!ready) {
      if ((opts.force || opts.idle) && d.leafCount === 0) {
        t.update(batchRef, { status: 'empty', sealedAt: FieldValue.serverTimestamp(), accepting: false });
        return { skip: true as const, data: { ...d, status: 'empty' } };
      }
      return { skip: true as const, data: d, notReady: true };
    }

    t.update(batchRef, { status: 'sealing', accepting: false });
    return { skip: false as const, data: d };
  });

  if (claimed.skip) {
    if ('deferSec' in claimed && typeof claimed.deferSec === 'number') {
      void enqueueIntegrityClose(campaignId, batchId, claimed.deferSec, { idle: true }).catch((e) =>
        console.warn('⚠️ No se pudo reprogramar cierre por inactividad:', e?.message)
      );
      return { status: 'open', leafCount: claimed.data.leafCount, deferredSec: claimed.deferSec };
    }
    if (claimed.data.status === 'anchored') {
      return {
        status: 'anchored',
        txHash: claimed.data.txHash,
        merkleRoot: claimed.data.merkleRoot,
        leafCount: claimed.data.leafCount,
      };
    }
    if (claimed.data.status === 'empty') return { status: 'empty', leafCount: 0 };
    return { status: claimed.data.status || 'open' };
  }

  const kind = claimed.data.kind as IntegrityKind;
  const leavesSnap = await batchRef.collection('leaves').get();
  const leaves = leavesSnap.docs
    .map((d) => ({ id: d.id, ...(d.data() as { messageId: string; leafHash: string; leafPayload: string; eventType?: string }) }))
    .sort((a, b) => a.id.localeCompare(b.id));

  if (leaves.length === 0) {
    await batchRef.update({ status: 'empty', sealedAt: FieldValue.serverTimestamp() });
    return { status: 'empty', leafCount: 0 };
  }

  try {
    const hashes = leaves.map((l) => l.leafHash);
    const tree = await buildMerkleTree(hashes);
    const prefix = kind === 'send' ? 'CAMPAIGN_SEND' : 'CAMPAIGN_EVENT';
    const campSnap = kind === 'send' ? await db.collection('campaigns').doc(campaignId).get() : null;
    const templateSealHash =
      kind === 'send' ? String(campSnap?.data()?.waTemplateSeal?.hash || '') : '';

    // Digest de todas las hojas: SHA-256 del JSON de leafHashes ordenados alfabéticamente
    // (independiente del orden del árbol). Payload v2: posición 7. v1 no tenía este campo.
    const leavesDigest = await computeLeavesDigest(hashes);

    const payloadParts = [
      prefix,
      ONCHAIN_PAYLOAD_VERSION,
      campaignId,
      batchId,
      tree.root,
      String(leaves.length),
      new Date().toISOString(),
      leavesDigest,
    ];
    if (templateSealHash) payloadParts.push(templateSealHash);
    const payload = payloadParts.join('|');

    const txHash = await Promise.race([
      sendPolygonTransaction(payload),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Timeout ancla Polygon (>40s)')), 40_000)
      ),
    ]);

    const writes: FirebaseFirestore.WriteBatch[] = [];
    let current = db.batch();
    let ops = 0;
    const flush = async () => {
      if (ops === 0) return;
      writes.push(current);
      await current.commit();
      current = db.batch();
      ops = 0;
    };

    for (let i = 0; i < leaves.length; i++) {
      const leaf = leaves[i];
      const proof = getMerkleProof(tree.layers, i);
      current.update(batchRef.collection('leaves').doc(leaf.id), { leafIndex: i, proof, merkleRoot: tree.root, txHash });
      ops += 1;

      const msgRef = db.collection('campaign_messages').doc(leaf.messageId);
      if (kind === 'send') {
        current.update(msgRef, {
          'integrity.send.leafIndex': i,
          'integrity.send.proof': proof,
          'integrity.send.merkleRoot': tree.root,
          'integrity.send.txHash': txHash,
          'integrity.send.batchId': batchId,
          txHashEnvio: txHash,
          emailTxEnvio: txHash,
        });
        ops += 1;
      } else if (leaf.eventType) {
        const ev = leaf.eventType as IntegrityEventType;
        current.update(msgRef, {
          [`integrity.events.${ev}.leafIndex`]: i,
          [`integrity.events.${ev}.proof`]: proof,
          [`integrity.events.${ev}.merkleRoot`]: tree.root,
          [`integrity.events.${ev}.txHash`]: txHash,
          [`integrity.events.${ev}.batchId`]: batchId,
          ...(ev === 'email_read' ? { emailTxLectura: txHash, txHashLectura: txHash } : {}),
          ...(ev === 'wa_delivered' ? { waTxEntregado: txHash } : {}),
          ...(ev === 'wa_read' ? { waTxLeido: txHash } : {}),
        });
        ops += 1;
      }

      if (ops >= 400) await flush();
    }

    current.update(batchRef, {
      status: 'anchored',
      merkleRoot: tree.root,
      txHash,
      payload,
      leavesDigest,
      leafCount: leaves.length,
      sealedAt: FieldValue.serverTimestamp(),
      accepting: false,
      errorMsg: FieldValue.delete(),
      ...(templateSealHash ? { templateSealHash } : {}),
    });
    ops += 1;
    await flush();
    if (ops > 0) await current.commit();

    return { status: 'anchored', txHash, merkleRoot: tree.root, leafCount: leaves.length, leavesDigest };
  } catch (e: unknown) {
    const errorMsg = e instanceof Error ? e.message : 'Error al anclar tanda';
    await batchRef.update({ status: 'failed', errorMsg, accepting: false });
    console.error('❌ closeIntegrityBatch', campaignId, batchId, errorMsg);
    return { status: 'failed', error: errorMsg, leafCount: leaves.length };
  }
}

export type IntegrityBatchVerify = {
  batchId: string;
  status: string;
  leafCount: number;
  payloadVersion: string | null;
  merkleMatch: boolean | null;
  storedRoot: string | null;
  rebuiltRoot: string | null;
  onChainRoot: string | null;
  onChainRootMatch: boolean | null;
  computedDigest: string | null;
  payloadDigest: string | null;
  digestMatch: boolean | null;
  onChainDigest: string | null;
  onChainDigestMatch: boolean | null;
  payloadHashMismatches: number;
  intact: boolean;
};

/** Verificación de tanda: reconstruye el árbol y el digest. No se usa en el chequeo por destinatario. */
export async function verifyIntegrityBatch(
  campaignId: string,
  batchId: string
): Promise<IntegrityBatchVerify> {
  const batchRef = batchesCol(campaignId).doc(batchId);
  const snap = await batchRef.get();
  if (!snap.exists) throw new Error('Tanda no encontrada');
  const d = snap.data()!;
  const storedPayload = typeof d.payload === 'string' ? d.payload : null;
  const storedRoot = typeof d.merkleRoot === 'string' ? d.merkleRoot : null;

  const leavesSnap = await batchRef.collection('leaves').get();
  const leaves = leavesSnap.docs
    .map((doc) => ({
      id: doc.id,
      ...(doc.data() as { leafHash?: string; leafPayload?: string }),
    }))
    .sort((a, b) => a.id.localeCompare(b.id));

  let payloadHashMismatches = 0;
  for (const leaf of leaves) {
    if (!leaf.leafPayload || !leaf.leafHash) {
      payloadHashMismatches += 1;
      continue;
    }
    const hashed = await sha256Hex(leaf.leafPayload);
    if (hashed !== leaf.leafHash) payloadHashMismatches += 1;
  }

  const hashes = leaves.map((l) => String(l.leafHash || ''));
  const rebuiltRoot = hashes.length > 0 ? (await buildMerkleTree(hashes)).root : null;
  const computedDigest = hashes.length > 0 ? await computeLeavesDigest(hashes) : null;
  const payloadDigest = extractLeavesDigestFromPayload(storedPayload);
  const payloadVersion = storedPayload ? storedPayload.split('|')[1] || null : null;

  const merkleMatch = Boolean(rebuiltRoot && storedRoot && rebuiltRoot === storedRoot);
  const digestMatch = payloadDigest && computedDigest ? payloadDigest === computedDigest : payloadDigest ? false : null;

  let onChainRoot: string | null = null;
  let onChainDigest: string | null = null;
  let onChainRootMatch: boolean | null = null;
  let onChainDigestMatch: boolean | null = null;
  if (typeof d.txHash === 'string' && d.txHash) {
    try {
      const { getTransactionInfo } = await import('@/lib/blockchain');
      const info = await getTransactionInfo(d.txHash);
      const onChainPayload = info?.data ?? null;
      onChainRoot = extractMerkleRootFromPayload(onChainPayload);
      onChainDigest = extractLeavesDigestFromPayload(onChainPayload);
      onChainRootMatch = Boolean(onChainRoot && storedRoot && onChainRoot === storedRoot);
      if (onChainDigest && computedDigest) onChainDigestMatch = onChainDigest === computedDigest;
      else if (onChainDigest) onChainDigestMatch = false;
      else onChainDigestMatch = payloadVersion === ONCHAIN_PAYLOAD_VERSION ? false : null;
    } catch {
      onChainRootMatch = null;
      onChainDigestMatch = null;
    }
  }

  const intact =
    payloadHashMismatches === 0 &&
    merkleMatch &&
    digestMatch !== false &&
    onChainRootMatch !== false &&
    onChainDigestMatch !== false;

  return {
    batchId,
    status: String(d.status || ''),
    leafCount: leaves.length,
    payloadVersion,
    merkleMatch: hashes.length > 0 ? merkleMatch : null,
    storedRoot,
    rebuiltRoot,
    onChainRoot,
    onChainRootMatch,
    computedDigest,
    payloadDigest,
    digestMatch,
    onChainDigest,
    onChainDigestMatch,
    payloadHashMismatches,
    intact,
  };
}

export async function listIntegrityBatches(campaignId: string): Promise<IntegrityBatch[]> {
  const snap = await batchesCol(campaignId).get();
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<IntegrityBatch, 'id'>) }))
    .sort((a, b) => {
      const ka = `${a.kind}-${a.tandaIndex ?? a.dayKey ?? a.id}`;
      const kb = `${b.kind}-${b.tandaIndex ?? b.dayKey ?? b.id}`;
      return ka.localeCompare(kb);
    });
}

export async function verifyCampaignMessage(campaignId: string, messageId: string) {
  const db = getAdminDb();
  const msgSnap = await db.collection('campaign_messages').doc(messageId).get();
  if (!msgSnap.exists) throw new Error('Destinatario no encontrado');
  const msg = msgSnap.data()!;
  if (String(msg.campaignId) !== campaignId) throw new Error('El destinatario no pertenece a esta campaña');

  const send = msg.integrity?.send as
    | {
        batchId?: string;
        leafHash?: string;
        leafIndex?: number;
        proof?: string[];
        merkleRoot?: string;
        txHash?: string;
        contentHash?: string;
        smtpMessageId?: string;
        wamid?: string;
        waBodyHash?: string;
        templateSealHash?: string;
        waVars?: Record<string, string>;
      }
    | undefined;

  const campSnap = await db.collection('campaigns').doc(campaignId).get();
  const campaign = campSnap.data() || {};
  const { findEvidenceSnapshot } = await import('@/lib/evidence-snapshot');
  const snapshot = await findEvidenceSnapshot({
    mailId: typeof msg.mailId === 'string' ? msg.mailId : null,
    campaignMessageId: messageId,
  });
  const storedHash = send?.contentHash || '';
  const currentHash = snapshot?.contentHash || storedHash || '';
  const contentMatch = snapshot
    ? Boolean(storedHash) && currentHash === storedHash
    : null;

  let merkleValid: boolean | null = null;
  if (send?.leafHash && send.proof && send.merkleRoot != null && typeof send.leafIndex === 'number') {
    merkleValid = await verifyMerkleProof(send.leafHash, send.proof, send.merkleRoot, send.leafIndex);
  }

  let onChainRoot: string | null = null;
  let onChainMatch: boolean | null = null;
  if (send?.txHash) {
    try {
      const { getTransactionInfo } = await import('@/lib/blockchain');
      const info = await getTransactionInfo(send.txHash);
      onChainRoot = extractMerkleRootFromPayload(info?.data ?? null);
      onChainMatch = Boolean(onChainRoot && send.merkleRoot && onChainRoot === send.merkleRoot);
    } catch {
      onChainMatch = null;
    }
  }

  const events = (msg.integrity?.events || {}) as Record<
    string,
    { batchId?: string; leafHash?: string; proof?: string[]; merkleRoot?: string; txHash?: string; occurredAt?: string }
  >;

  const eventResults = await Promise.all(
    (['email_read', 'wa_delivered', 'wa_read'] as IntegrityEventType[]).map(async (type) => {
      const ev = events[type];
      if (!ev?.leafHash) return { type, present: false as const };
      let proofOk: boolean | null = null;
      if (ev.proof && ev.merkleRoot != null && typeof (ev as { leafIndex?: number }).leafIndex === 'number') {
        proofOk = await verifyMerkleProof(
          ev.leafHash,
          ev.proof,
          ev.merkleRoot,
          (ev as { leafIndex: number }).leafIndex
        );
      }
      return {
        type,
        present: true as const,
        occurredAt: ev.occurredAt,
        merkleValid: proofOk,
        txHash: ev.txHash,
        merkleRoot: ev.merkleRoot,
        batchId: ev.batchId,
      };
    })
  );

  const intact =
    merkleValid === true && onChainMatch !== false && contentMatch !== false;

  return {
    messageId,
    recipientNombre: snapshot?.recipient.nombre || msg.recipientNombre || '',
    recipientEmail: snapshot?.recipient.email || msg.recipientEmail || '',
    recipientTelefono: snapshot?.recipient.phone || msg.recipientTelefono || '',
    content: {
      currentHash,
      storedHash: storedHash || null,
      match: contentMatch,
    },
    send: {
      batchId: send?.batchId || null,
      txHash: send?.txHash || null,
      merkleRoot: send?.merkleRoot || null,
      leafHash: send?.leafHash || null,
      merkleValid,
      onChainRoot,
      onChainMatch,
      smtpMessageId: send?.smtpMessageId || null,
      wamid: send?.wamid || null,
      waBodyHash: send?.waBodyHash || null,
      templateSealHash: send?.templateSealHash || null,
      waVars: send?.waVars || null,
    },
    template: campaign.waTemplateSeal
      ? {
          hash: String(campaign.waTemplateSeal.hash || ''),
          name: String(campaign.waTemplateSeal.templateName || campaign.waTemplateName || ''),
          lang: String(campaign.waTemplateSeal.templateLang || ''),
          variables: Array.isArray(campaign.waTemplateSeal.templateVariables)
            ? campaign.waTemplateSeal.templateVariables
            : [],
        }
      : null,
    events: eventResults,
    intact,
    summary: intact
      ? 'Este destinatario es un renglón del padrón: el formulario (template) es el de la campaña y sus datos cierran contra la tanda en Polygon.'
      : !send?.txHash
        ? 'Este destinatario todavía no está en una tanda cerrada. Cerrá la tanda de envío para poder probarlo.'
        : 'Hay una diferencia: el contenido o la prueba Merkle no cierran contra la blockchain.',
  };
}
