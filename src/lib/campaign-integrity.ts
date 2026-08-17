import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase-admin';
import { sendPolygonTransaction } from '@/lib/blockchain';
import { computeContentHash } from '@/lib/certification';
import { buildMerkleTree, getMerkleProof, sha256Hex, verifyMerkleProof } from '@/lib/merkle';
import { enqueueIntegrityClose } from '@/lib/cloud-tasks';

export const SEND_TANDA_SIZE = 500;
export const EVENT_TANDA_SIZE = 500;
export const SEND_CLOSE_DELAY_SEC = 15 * 60;
export const EVENT_CLOSE_DELAY_SEC = 60 * 60;

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
  merkleRoot?: string;
  txHash?: string;
  payload?: string;
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

export function eventBatchId(at = new Date()): string {
  return `events-${at.toISOString().slice(0, 10)}`;
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

/** Hojas nuevas: …|waBodyHash|templateSealHash. Las viejas se verifican con el leafPayload guardado. */
export function buildSendLeafPayload(input: {
  campaignId: string;
  messageId: string;
  email: string;
  phone: string;
  contentHash: string;
  attachmentHashes: string[];
  smtpMessageId: string;
  wamid: string;
  waBodyHash?: string;
  templateSealHash?: string;
}): string {
  const att = [...input.attachmentHashes].filter(Boolean).sort().join(',');
  return [
    'v1',
    'send',
    input.campaignId,
    input.messageId,
    (input.email || '').trim().toLowerCase(),
    (input.phone || '').replace(/\D/g, ''),
    input.contentHash,
    att,
    input.smtpMessageId || '',
    input.wamid || '',
    input.waBodyHash || '',
    input.templateSealHash || '',
  ].join('|');
}

export function buildEventLeafPayload(input: {
  campaignId: string;
  messageId: string;
  eventType: IntegrityEventType;
  occurredAt: string;
  sendLeafHash: string;
}): string {
  return [
    'v1',
    'event',
    input.campaignId,
    input.messageId,
    input.eventType,
    input.occurredAt,
    input.sendLeafHash || '',
  ].join('|');
}

export function extractMerkleRootFromPayload(payload: string | null): string | null {
  if (!payload) return null;
  const parts = payload.split('|');
  if (parts[0] !== 'CAMPAIGN_SEND' && parts[0] !== 'CAMPAIGN_EVENT') return null;
  const root = parts[4]?.trim();
  return root && root.length === 64 ? root : null;
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
      });
    } else {
      t.update(batchRef, {
        leafCount: FieldValue.increment(1),
        sealedCount: FieldValue.increment(1),
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
      },
    });
    return { already: false as const };
  });

  if (!result.already) {
    await maybeEnqueueClose(params.campaignId, params.batchId, 'send');
  }

  return { leafHash, already: result.already };
}

/** Destinatario que falló: cuenta para cerrar la tanda, sin hoja. */
export async function recordSendError(params: {
  campaignId: string;
  messageId: string;
  batchId: string;
}): Promise<void> {
  const db = getAdminDb();
  const msgRef = db.collection('campaign_messages').doc(params.messageId);
  const batchRef = batchesCol(params.campaignId).doc(params.batchId);

  const added = await db.runTransaction(async (t) => {
    const msgSnap = await t.get(msgRef);
    const msg = msgSnap.data();
    if (!msg || msg.integritySendSealed) return false;
    const batchSnap = await t.get(batchRef);
    if (!batchSnap.exists) return false;
    t.update(msgRef, { integritySendSealed: true, integritySendBatchId: params.batchId });
    t.update(batchRef, { sealedCount: FieldValue.increment(1) });
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
}): Promise<{ leafHash: string; already: boolean; batchId: string }> {
  const db = getAdminDb();
  const occurredAt = params.occurredAt || new Date().toISOString();
  const batchId = eventBatchId(new Date(occurredAt));
  const batchRef = batchesCol(params.campaignId).doc(batchId);
  const leafId = `${params.messageId}_${params.eventType}`;
  const leafRef = batchRef.collection('leaves').doc(leafId);
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
  });
  const leafHash = await sha256Hex(leafPayload);

  const already = await db.runTransaction(async (t) => {
    const existing = await t.get(leafRef);
    if (existing.exists) return true;

    const batchSnap = await t.get(batchRef);
    if (!batchSnap.exists) {
      t.set(batchRef, {
        campaignId: params.campaignId,
        orgId: params.orgId || String(msg?.orgId || ''),
        kind: 'event',
        dayKey: batchId.replace(/^events-/, ''),
        status: 'open',
        accepting: true,
        expectedCount: 0,
        sealedCount: 0,
        leafCount: 1,
        createdAt: FieldValue.serverTimestamp(),
      });
    } else {
      t.update(batchRef, { leafCount: FieldValue.increment(1) });
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
    return false;
  });

  if (!already) {
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
  opts: { force?: boolean } = {}
): Promise<{ status: string; txHash?: string; merkleRoot?: string; leafCount?: number; error?: string }> {
  const db = getAdminDb();
  const batchRef = batchesCol(campaignId).doc(batchId);

  const claimed = await db.runTransaction(async (t) => {
    const snap = await t.get(batchRef);
    if (!snap.exists) throw new Error('Tanda no encontrada');
    const d = snap.data()!;
    if (d.status === 'anchored') return { skip: true as const, data: d };
    if (d.status === 'sealing') return { skip: true as const, data: d };
    if (d.status !== 'open') return { skip: true as const, data: d };

    const ready =
      opts.force ||
      (d.kind === 'send' &&
        d.leafCount > 0 &&
        (d.sealedCount >= SEND_TANDA_SIZE ||
          (d.sealedCount >= d.expectedCount && d.expectedCount > 0 && d.accepting === false))) ||
      (d.kind === 'event' && d.leafCount >= EVENT_TANDA_SIZE) ||
      (opts.force && d.leafCount > 0);

    if (!ready) {
      if (opts.force && d.leafCount === 0) {
        t.update(batchRef, { status: 'empty', sealedAt: FieldValue.serverTimestamp(), accepting: false });
        return { skip: true as const, data: { ...d, status: 'empty' } };
      }
      return { skip: true as const, data: d, notReady: true };
    }

    t.update(batchRef, { status: 'sealing', accepting: false });
    return { skip: false as const, data: d };
  });

  if (claimed.skip) {
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
    const payloadParts = [
      prefix,
      'v1',
      campaignId,
      batchId,
      tree.root,
      String(leaves.length),
      new Date().toISOString(),
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
      leafCount: leaves.length,
      sealedAt: FieldValue.serverTimestamp(),
      accepting: false,
      errorMsg: FieldValue.delete(),
      ...(templateSealHash ? { templateSealHash } : {}),
    });
    ops += 1;
    await flush();
    if (ops > 0) await current.commit();

    return { status: 'anchored', txHash, merkleRoot: tree.root, leafCount: leaves.length };
  } catch (e: unknown) {
    const errorMsg = e instanceof Error ? e.message : 'Error al anclar tanda';
    await batchRef.update({ status: 'failed', errorMsg, accepting: false });
    console.error('❌ closeIntegrityBatch', campaignId, batchId, errorMsg);
    return { status: 'failed', error: errorMsg, leafCount: leaves.length };
  }
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
  const { personalizeCampaignText } = await import('@/lib/campaign-email-html');
  const body = personalizeCampaignText(String(campaign.cuerpo || ''), {
    nombre: String(msg.recipientNombre || ''),
    dni: msg.recipientDni,
    legajo: msg.recipientLegajo,
  });
  const currentHash = await computeContentHash(body);
  const storedHash = send?.contentHash || '';
  const contentMatch = Boolean(storedHash) && currentHash === storedHash;

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

  const intact = contentMatch && merkleValid === true && onChainMatch !== false;

  return {
    messageId,
    recipientNombre: msg.recipientNombre || '',
    recipientEmail: msg.recipientEmail || '',
    recipientTelefono: msg.recipientTelefono || '',
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
