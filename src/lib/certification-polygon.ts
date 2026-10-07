import { randomUUID } from 'crypto';
import { FieldValue, type DocumentReference } from 'firebase-admin/firestore';
import {
  broadcastPolygonCertification,
  inspectPolygonTx,
  sendPolygonTransaction,
  waitForPolygonMined,
} from './blockchain';
import { getAdminDb } from './firebase-admin';
import { buildWhatsAppOnChainPayload, hashWhatsAppBody } from './whatsapp-evidence';
import {
  applyHitoClaim,
  applySendClaim,
  blockchainMovementStatusForHash,
  blockchainMovementStatusForReceipt,
  buildHitoOnChainPayload,
  buildSendOnChainPayload,
  extractPolygonTxHashFromError,
  hashPolygonPayload,
  HITO_CLAIM_TTL_MS,
  isPolygonTxHash,
  sendCertificationId,
  shouldReleaseHitoPending,
  type PolygonSendOperation,
} from './polygon-send-logic';

/**
 * Registro en Firestore vía Admin (las reglas del cliente bloqueaban `blockchain_movements`).
 * Si falla después de una TX confirmada en Polygon, no se lanza error: el hash on-chain sigue siendo válido.
 */
async function persistBlockchainMovement(
  fields: Record<string, unknown>,
  txHash: string,
  context: string
): Promise<void> {
  try {
    const status =
      typeof fields.status === 'string' ? fields.status : blockchainMovementStatusForHash();
    await getAdminDb()
      .collection('blockchain_movements')
      .doc(txHash)
      .set(
        {
          ...fields,
          txHash,
          timestamp: FieldValue.serverTimestamp(),
          status,
        },
        { merge: true }
      );
  } catch (e) {
    console.error(
      `❌ No se pudo registrar movimiento en Firestore (${context}). TX en cadena ya emitida:`,
      txHash,
      e
    );
  }
}

async function markBlockchainMovementMined(txHash: string): Promise<void> {
  try {
    await getAdminDb()
      .collection('blockchain_movements')
      .doc(txHash)
      .set(
        {
          status: blockchainMovementStatusForReceipt(),
          confirmedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
  } catch (e) {
    console.warn('⚠️ No se pudo marcar movement mined:', txHash, e);
  }
}

function scheduleMovementMined(txHash: string): void {
  void waitForPolygonMined(txHash)
    .then(async (mined) => {
      if (mined) await markBlockchainMovementMined(txHash);
    })
    .catch(() => undefined);
}

export const POLYGON_HITO_FIELDS = {
  wa_delivered: 'waDelivered',
  wa_read: 'waRead',
  content_access: 'contentAccess',
  read_confirmed: 'readConfirmed',
} as const;

export type PolygonHitoType = keyof typeof POLYGON_HITO_FIELDS;

const HITO_PREFIX: Record<PolygonHitoType, string> = {
  wa_delivered: 'WA_DELIVERED',
  wa_read: 'WA_READ',
  content_access: 'CONTENT_ACCESS',
  read_confirmed: 'READ_CONFIRMED',
};

/**
 * Certifica un hecho concreto (canal + tipo) en Polygon.
 * Cada hito es independiente: WhatsApp entregado no tapa el acceso al correo.
 */
export async function certificarHito(opts: {
  messageId: string;
  userId: string;
  hito: PolygonHitoType;
  sendTxHash?: string;
  contentHash?: string;
  snapshotHash?: string;
  wamid?: string;
  via?: string;
  payload?: string;
}): Promise<string> {
  const { messageId, userId, hito, sendTxHash, contentHash, snapshotHash, wamid, via } = opts;
  const payload =
    opts.payload ||
    buildHitoOnChainPayload({
      prefix: HITO_PREFIX[hito],
      messageId,
      userId,
      contentHash,
      via,
      snapshotHash,
      wamid,
      sendTxHash,
      timestamp: new Date().toISOString(),
    });

  console.log(`🔗 Certificando hito ${hito}:`, { messageId, userId, via: via ?? null });

  const txHash = await sendPolygonTransaction(payload);
  const field = POLYGON_HITO_FIELDS[hito];
  await getAdminDb()
    .collection('mail')
    .doc(messageId)
    .update({
      [`polygonCertifications.${field}`]: txHash,
      'polygonCertifications.updatedAt': new Date(),
    })
    .catch(() => undefined);

  await persistBlockchainMovement(
    {
      type: hito,
      userId,
      messageId,
      txHash,
      payload,
      payloadHash: hashPolygonPayload(payload),
      sendTxHash: sendTxHash ?? null,
      contentHash: contentHash ?? null,
      via: via ?? null,
      status: blockchainMovementStatusForHash(),
    },
    txHash,
    hito
  );

  scheduleMovementMined(txHash);

  return txHash;
}

/** Idempotente: un solo TX por hito. Reserva el cupo antes de gastar gas. */
export async function certifyMailHitoIfNeeded(opts: {
  docId: string;
  hito: PolygonHitoType;
  via?: string;
}): Promise<string | null> {
  const { docId, hito, via } = opts;
  const field = POLYGON_HITO_FIELDS[hito];
  const pendingField = `${field}Pending`;
  const payloadField = `${field}Payload`;
  const expiresField = `${field}ClaimExpiresAt`;
  const db = getAdminDb();
  const mailRef = db.collection('mail').doc(docId);

  const claim = await db.runTransaction(async (t) => {
    const snap = await t.get(mailRef);
    const data = snap.data();
    if (!data || data.campaignId) return { action: 'skip' as const, txHash: null as string | null, payload: null as string | null };

    const existing = (data.polygonCertifications || {}) as Record<string, unknown>;
    const decided = applyHitoClaim({
      existingTxHash: existing[field],
      pending: existing[pendingField],
      existingPayload: existing[payloadField],
      claimExpiresAt: existing[expiresField],
      nowMs: Date.now(),
    });

    if (decided.action === 'exists') {
      return { action: 'exists' as const, txHash: decided.txHash, payload: decided.payload };
    }
    if (decided.action === 'pending') {
      return { action: 'pending' as const, txHash: null as string | null, payload: decided.payload };
    }

    const recipientId =
      data.recipientEmail ||
      (Array.isArray(data.to) ? data.to[0] : data.to) ||
      'recipient';

    const payload =
      decided.payload ||
      buildHitoOnChainPayload({
        prefix: HITO_PREFIX[hito],
        messageId: docId,
        userId: String(recipientId),
        contentHash: typeof existing.contentHash === 'string' ? existing.contentHash : undefined,
        via,
        snapshotHash:
          typeof data.evidenceSnapshotHash === 'string' ? data.evidenceSnapshotHash : undefined,
        wamid:
          typeof data.whatsappMessageId === 'string'
            ? data.whatsappMessageId
            : typeof (data.tracking as { whatsappMessageId?: string } | undefined)?.whatsappMessageId ===
                'string'
              ? (data.tracking as { whatsappMessageId: string }).whatsappMessageId
              : undefined,
        sendTxHash: typeof existing.send === 'string' ? existing.send : undefined,
        timestamp: new Date().toISOString(),
      });

    t.update(mailRef, {
      [`polygonCertifications.${pendingField}`]: true,
      [`polygonCertifications.${payloadField}`]: payload,
      [`polygonCertifications.${expiresField}`]: Date.now() + HITO_CLAIM_TTL_MS,
      'polygonCertifications.updatedAt': new Date(),
    });

    return {
      action: 'claim' as const,
      txHash: null as string | null,
      payload,
      recipientId: String(recipientId),
      sendTxHash: existing.send as string | undefined,
      contentHash: existing.contentHash as string | undefined,
      snapshotHash:
        typeof data.evidenceSnapshotHash === 'string' ? data.evidenceSnapshotHash : undefined,
      wamid:
        typeof data.whatsappMessageId === 'string'
          ? data.whatsappMessageId
          : typeof (data.tracking as { whatsappMessageId?: string } | undefined)?.whatsappMessageId ===
              'string'
            ? (data.tracking as { whatsappMessageId: string }).whatsappMessageId
            : undefined,
    };
  });

  if (claim.action === 'skip' || claim.action === 'pending') {
    if (claim.action === 'pending') {
      console.log(`ℹ️ Polygon ${hito} ya en curso para`, docId);
    }
    return claim.txHash;
  }
  if (claim.action === 'exists') {
    console.log(`ℹ️ Polygon ${hito} ya certificado para`, docId);
    return claim.txHash;
  }

  try {
    const txHash = await certificarHito({
      messageId: docId,
      userId: claim.recipientId,
      hito,
      sendTxHash: claim.sendTxHash,
      contentHash: claim.contentHash,
      snapshotHash: claim.snapshotHash,
      wamid: claim.wamid,
      via,
      payload: claim.payload || undefined,
    });

    const update: Record<string, unknown> = {
      [`polygonCertifications.${field}`]: txHash,
      [`polygonCertifications.${pendingField}`]: FieldValue.delete(),
      'polygonCertifications.updatedAt': new Date(),
    };
    if (hito === 'content_access' && via) {
      update['polygonCertifications.contentAccessVia'] = via;
    }
    await mailRef.update(update);
    console.log(`✅ Hito ${hito} certificado en Polygon:`, txHash);
    return txHash;
  } catch (e) {
    const extracted = extractPolygonTxHashFromError(e);
    if (extracted) {
      await mailRef
        .update({
          [`polygonCertifications.${field}`]: extracted,
          [`polygonCertifications.${pendingField}`]: FieldValue.delete(),
          'polygonCertifications.updatedAt': new Date(),
        })
        .catch(() => {});
    } else if (shouldReleaseHitoPending(e, extracted)) {
      await mailRef
        .update({
          [`polygonCertifications.${pendingField}`]: FieldValue.delete(),
          'polygonCertifications.updatedAt': new Date(),
        })
        .catch(() => {});
    }
    throw e;
  }
}

export async function certificarLectura(messageId: string, userId: string): Promise<string> {
  const timestamp = new Date().toISOString();
  const payload = `READ|${messageId}|${userId}|${timestamp}`;

  console.log('📖 Certificando lectura de mensaje:', { messageId, userId });

  const txHash = await sendPolygonTransaction(payload);

  await persistBlockchainMovement(
    {
      type: 'read',
      userId,
      messageId,
      txHash,
      payload,
      status: blockchainMovementStatusForHash(),
    },
    txHash,
    'read'
  );
  scheduleMovementMined(txHash);

  console.log('✅ Lectura certificada en Polygon:', txHash);
  return txHash;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sendOperationFromUnknown(value: unknown): PolygonSendOperation | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as PolygonSendOperation;
}

async function persistSendOperation(
  mailRef: DocumentReference,
  patch: Record<string, unknown>
): Promise<void> {
  await mailRef.update({
    ...patch,
    'polygonCertifications.updatedAt': new Date(),
  });
}

async function reconcileExistingSend(
  mailRef: DocumentReference,
  txHash: string,
  operation: PolygonSendOperation | null
): Promise<string> {
  try {
    const chain = await inspectPolygonTx(txHash);
    const status =
      chain === 'mined' ? 'mined' : chain === 'pending' ? 'pending' : operation?.status === 'broadcast' ? 'dropped' : 'dropped';
    const patch: Record<string, unknown> = {
      'polygonCertifications.send': txHash,
      'polygonCertifications.sendOperation.status': status,
      'polygonCertifications.sendOperation.txHash': txHash,
      'polygonCertifications.sendOperation.lastError': null,
    };
    if (status === 'mined') {
      patch['polygonCertifications.sendOperation.confirmedAt'] = new Date();
    }
    await persistSendOperation(mailRef, patch);
    console.log(
      JSON.stringify({
        msg: 'polygon_sender',
        event: 'send_reconcile',
        mailId: mailRef.id,
        certificationId: sendCertificationId(mailRef.id),
        txHash,
        status,
      })
    );
  } catch (e) {
    console.warn('⚠️ No se pudo reconciliar TX Polygon:', e instanceof Error ? e.message : e);
  }
  return txHash;
}

async function claimSendOperation(
  mailRef: DocumentReference,
  input: {
    fromUserId: string;
    toEmail: string;
    contentHash?: string;
    smtpMessageId?: string;
    claimId: string;
  }
) {
  const db = getAdminDb();
  return db.runTransaction(async (t) => {
    const snap = await t.get(mailRef);
    if (!snap.exists) throw new Error(`Mensaje no encontrado: ${mailRef.id}`);
    const data = snap.data() || {};
    const existing = (data.polygonCertifications || {}) as Record<string, unknown>;
    const decided = applySendClaim({
      existingSend: existing.send,
      operation: sendOperationFromUnknown(existing.sendOperation),
      nowMs: Date.now(),
      claimId: input.claimId,
      mailId: mailRef.id,
      buildPayload: () => {
        const timestamp = new Date().toISOString();
        const payload = buildSendOnChainPayload({
          messageId: mailRef.id,
          fromUserId: input.fromUserId,
          toEmail: input.toEmail,
          contentHash: input.contentHash,
          smtpMessageId: input.smtpMessageId,
          timestamp,
        });
        return { payload, payloadHash: hashPolygonPayload(payload), timestamp };
      },
    });

    if (decided.operation && decided.action === 'claim') {
      t.update(mailRef, {
        'polygonCertifications.sendOperation': {
          certificationId: decided.operation.certificationId,
          mailId: decided.operation.mailId,
          type: 'send',
          payload: decided.operation.payload,
          payloadHash: decided.operation.payloadHash,
          timestamp: decided.operation.timestamp,
          nonce: decided.operation.nonce ?? null,
          txHash: decided.operation.txHash ?? null,
          status: 'reserved',
          retryCount: 0,
          lastError: null,
          claimOwner: decided.operation.claimOwner,
          claimExpiresAt: decided.operation.claimExpiresAt,
          createdAt: FieldValue.serverTimestamp(),
        },
        ...(input.contentHash ? { 'polygonCertifications.contentHash': input.contentHash } : {}),
        'polygonCertifications.updatedAt': new Date(),
      });
    } else if (decided.operation && decided.action === 'recover') {
      t.update(mailRef, {
        'polygonCertifications.sendOperation.status': 'reserved',
        'polygonCertifications.sendOperation.claimOwner': decided.operation.claimOwner,
        'polygonCertifications.sendOperation.claimExpiresAt': decided.operation.claimExpiresAt,
        'polygonCertifications.sendOperation.retryCount': decided.operation.retryCount ?? 0,
        'polygonCertifications.sendOperation.lastError': null,
        'polygonCertifications.updatedAt': new Date(),
      });
    }

    return decided;
  });
}

export async function certificarEnvio(
  messageId: string,
  fromUserId: string,
  toEmail: string,
  contentHash?: string,
  smtpMessageId?: string,
): Promise<string> {
  const mailRef = getAdminDb().collection('mail').doc(messageId);
  const claimId = randomUUID();
  const claimArgs = { fromUserId, toEmail, contentHash, smtpMessageId, claimId };

  let decided = await claimSendOperation(mailRef, claimArgs);

  if (decided.action === 'exists' && decided.txHash) {
    console.log('ℹ️ Polygon SEND ya certificado para', messageId, decided.txHash);
    return reconcileExistingSend(mailRef, decided.txHash, decided.operation);
  }

  if (decided.action === 'in_flight') {
    for (let i = 0; i < 30; i++) {
      await sleep(500);
      const snap = await mailRef.get();
      const existing = (snap.data()?.polygonCertifications || {}) as Record<string, unknown>;
      if (isPolygonTxHash(existing.send)) {
        return reconcileExistingSend(mailRef, existing.send, sendOperationFromUnknown(existing.sendOperation));
      }
    }
    decided = await claimSendOperation(mailRef, { ...claimArgs, claimId: randomUUID() });
    if (decided.action === 'exists' && decided.txHash) {
      return reconcileExistingSend(mailRef, decided.txHash, decided.operation);
    }
    if (decided.action === 'in_flight') {
      throw new Error(`POLYGON_SEND_IN_FLIGHT:${messageId}`);
    }
  }

  const payload = decided.payload;
  if (!payload) {
    throw new Error(`POLYGON_SEND_MISSING_PAYLOAD:${messageId}`);
  }

  console.log(
    JSON.stringify({
      msg: 'polygon_sender',
      event: decided.action === 'recover' ? 'send_recover' : 'send_claim',
      mailId: messageId,
      certificationId: sendCertificationId(messageId),
      payloadHash: decided.payloadHash,
      status: 'reserved',
      retryCount: decided.retryCount,
    })
  );

  try {
    const result = await broadcastPolygonCertification({
      data: payload,
      certificationId: sendCertificationId(messageId),
      kind: 'mail_send',
      entityId: messageId,
    });

    await persistSendOperation(mailRef, {
      'polygonCertifications.send': result.hash,
      'polygonCertifications.sendOperation.txHash': result.hash,
      'polygonCertifications.sendOperation.nonce': result.nonce,
      'polygonCertifications.sendOperation.status': 'broadcast',
      'polygonCertifications.sendOperation.broadcastAt': new Date(),
      'polygonCertifications.sendOperation.lastError': null,
      'polygonCertifications.sendOperation.claimOwner': null,
      'polygonCertifications.sendOperation.claimExpiresAt': null,
    });

    await persistBlockchainMovement(
      {
        type: 'send',
        userId: fromUserId,
        messageId,
        toEmail,
        contentHash: contentHash ?? null,
        smtpMessageId: smtpMessageId ?? null,
        txHash: result.hash,
        nonce: result.nonce,
        payload,
        payloadHash: decided.payloadHash,
        certificationId: sendCertificationId(messageId),
        status: 'broadcast',
        retryCount: decided.retryCount,
      },
      result.hash,
      'send'
    );

    void waitForPolygonMined(result.hash)
      .then(async (mined) => {
        if (!mined) return;
        await persistSendOperation(mailRef, {
          'polygonCertifications.sendOperation.status': 'mined',
          'polygonCertifications.sendOperation.confirmedAt': new Date(),
        });
        await markBlockchainMovementMined(result.hash);
      })
      .catch(() => undefined);

    console.log('✅ Envío certificado en Polygon:', result.hash);
    return result.hash;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const pending = message.startsWith('POLYGON_TX_STILL_PENDING:');
    await persistSendOperation(mailRef, {
      'polygonCertifications.sendOperation.status': pending ? 'pending' : 'failed',
      'polygonCertifications.sendOperation.lastError': message,
    }).catch(() => undefined);
    throw error;
  }
}

/**
 * Certifica el hash SHA-256 del certificado PDF generado para este mensaje.
 * Encadena al TX de envío para que quede demostrable que el certificado
 * corresponde a un envío real y no fue generado artificialmente.
 */
export async function certificarDocumento(
  messageId: string,
  pdfHash: string,
  sendTxHash?: string,
): Promise<string> {
  const timestamp = new Date().toISOString();

  const parts = ['CERTIFICATE', messageId, `sha256:${pdfHash}`];
  if (sendTxHash) parts.push(`ref:${sendTxHash}`);
  parts.push(timestamp);
  const payload = parts.join('|');

  console.log('📄 Certificando PDF del mensaje:', {
    messageId,
    pdfHash,
    chainedToSend: !!sendTxHash,
  });

  const txHash = await sendPolygonTransaction(payload);

  await persistBlockchainMovement(
    {
      type: 'certificate',
      messageId,
      pdfHash,
      sendTxHash: sendTxHash ?? null,
      txHash,
      payload,
      status: blockchainMovementStatusForHash(),
    },
    txHash,
    'certificate'
  );
  scheduleMovementMined(txHash);

  console.log('✅ PDF certificado en Polygon:', txHash);
  return txHash;
}

/**
 * Certifica la primera apertura (FIRST_READ) en Polygon.
 * @param sendTxHash - Hash de la TX de envío (encadena la lectura al send para prueba judicial)
 * @param contentHash - Hash del contenido del mensaje (mismo que en el send, verifica integridad)
 */
export async function certificarRecepcion(
  messageId: string,
  userId: string,
  sendTxHash?: string,
  contentHash?: string,
): Promise<string> {
  const timestamp = new Date().toISOString();

  // Payload encadenado al send: referencia sendTxHash y contentHash para que
  // cualquier auditor pueda vincular FIRST_READ ↔ SEND en la blockchain.
  const payload = sendTxHash && contentHash
    ? `FIRST_READ|${messageId}|${userId}|${contentHash}|ref:${sendTxHash}|${timestamp}`
    : sendTxHash
      ? `FIRST_READ|${messageId}|${userId}|ref:${sendTxHash}|${timestamp}`
      : `FIRST_READ|${messageId}|${userId}|${timestamp}`;

  console.log('📨 Certificando primera lectura de mensaje:', {
    messageId,
    userId,
    chainedToSend: !!sendTxHash,
    hasContentHash: !!contentHash,
  });

  const txHash = await sendPolygonTransaction(payload);

  await persistBlockchainMovement(
    {
      type: 'first_read',
      userId,
      messageId,
      txHash,
      payload,
      sendTxHash: sendTxHash ?? null,
      contentHash: contentHash ?? null,
      status: blockchainMovementStatusForHash(),
    },
    txHash,
    'first_read'
  );
  scheduleMovementMined(txHash);

  console.log('✅ Primera lectura certificada en Polygon:', txHash);
  return txHash;
}

export async function certificarWhatsApp(opts: {
  mailId: string;
  wamid: string;
  waBodyHash: string;
  templateName: string;
  to: string;
  payload?: string;
}): Promise<{ txHash: string; payload: string }> {
  const timestamp = new Date().toISOString();
  const payload =
    opts.payload ||
    buildWhatsAppOnChainPayload({
      mailId: opts.mailId,
      wamid: opts.wamid,
      waBodyHash: opts.waBodyHash,
      templateName: opts.templateName,
      to: opts.to,
      timestamp,
    });

  console.log('📱 Certificando aviso WhatsApp:', {
    mailId: opts.mailId,
    wamid: opts.wamid,
    waBodyHash: opts.waBodyHash,
  });

  const txHash = await sendPolygonTransaction(payload);
  await getAdminDb()
    .collection('mail')
    .doc(opts.mailId)
    .update({
      'polygonCertifications.whatsapp': txHash,
      'polygonCertifications.updatedAt': new Date(),
    })
    .catch(() => undefined);

  await persistBlockchainMovement(
    {
      type: 'whatsapp',
      messageId: opts.mailId,
      wamid: opts.wamid,
      waBodyHash: opts.waBodyHash,
      templateName: opts.templateName || null,
      to: opts.to,
      txHash,
      payload,
      status: blockchainMovementStatusForHash(),
    },
    txHash,
    'whatsapp'
  );
  scheduleMovementMined(txHash);

  console.log('✅ Aviso WhatsApp certificado en Polygon:', txHash);
  return { txHash, payload };
}

/**
 * Ancla el hash del aviso de WhatsApp (template + variables + URL).
 * Campañas: solo persiste el hash (va en la hoja Merkle). 1:1: una TX WA|v1|…
 */
export async function certifyWhatsAppPayloadIfNeeded(mailId: string): Promise<string | null> {
  const db = getAdminDb();
  const mailRef = db.collection('mail').doc(mailId);
  const pre = await mailRef.get();
  if (!pre.exists) return null;
  const preData = pre.data()!;
  const waBodyHash = await hashWhatsAppBody(preData.waRequestSnapshot);
  const wamid = String(preData.whatsappMessageId || preData.tracking?.whatsappMessageId || '');
  if (!waBodyHash && !wamid) return null;

  const snapTo = preData.waRequestSnapshot && typeof preData.waRequestSnapshot === 'object'
    ? (preData.waRequestSnapshot as Record<string, unknown>)
    : {};
  const templateName = String(preData.waTemplateName || snapTo.templateName || '');
  const to = String(preData.recipientPhone || snapTo.to || '');

  const claim = await db.runTransaction(async (t) => {
    const snap = await t.get(mailRef);
    if (!snap.exists) return { action: 'skip' as const, txHash: null as string | null, payload: null as string | null };
    const data = snap.data()!;
    const existing = (data.polygonCertifications || {}) as Record<string, unknown>;
    const patch: Record<string, unknown> = {
      'polygonCertifications.updatedAt': new Date(),
    };
    if (waBodyHash && existing.waBodyHash !== waBodyHash) {
      patch['polygonCertifications.waBodyHash'] = waBodyHash;
    }

    if (data.campaignId) {
      if (Object.keys(patch).length > 1) t.update(mailRef, patch);
      return { action: 'campaign' as const, txHash: null as string | null, payload: null as string | null };
    }

    const decided = applyHitoClaim({
      existingTxHash: existing.whatsapp,
      pending: existing.whatsappPending,
      existingPayload: existing.whatsappPendingPayload || existing.whatsappPayload,
      claimExpiresAt: existing.whatsappClaimExpiresAt,
      nowMs: Date.now(),
    });

    if (decided.action === 'exists') {
      if (Object.keys(patch).length > 1) t.update(mailRef, patch);
      return { action: 'exists' as const, txHash: decided.txHash, payload: decided.payload };
    }
    if (decided.action === 'pending') {
      return { action: 'pending' as const, txHash: null as string | null, payload: decided.payload };
    }
    if (!waBodyHash || !wamid) {
      if (Object.keys(patch).length > 1) t.update(mailRef, patch);
      return { action: 'skip' as const, txHash: null as string | null, payload: null as string | null };
    }

    const payload =
      decided.payload ||
      buildWhatsAppOnChainPayload({
        mailId,
        wamid,
        waBodyHash,
        templateName,
        to,
        timestamp: new Date().toISOString(),
      });

    t.update(mailRef, {
      ...patch,
      'polygonCertifications.whatsappPending': true,
      'polygonCertifications.whatsappPendingPayload': payload,
      'polygonCertifications.whatsappClaimExpiresAt': Date.now() + HITO_CLAIM_TTL_MS,
    });

    return { action: 'claim' as const, txHash: null as string | null, payload };
  });

  if (claim.action === 'skip' || claim.action === 'campaign' || claim.action === 'pending') {
    return null;
  }
  if (claim.action === 'exists') {
    return claim.txHash;
  }

  try {
    const { txHash, payload } = await certificarWhatsApp({
      mailId,
      wamid,
      waBodyHash,
      templateName,
      to,
      payload: claim.payload || undefined,
    });
    await mailRef.update({
      'polygonCertifications.whatsapp': txHash,
      'polygonCertifications.whatsappPayload': payload,
      'polygonCertifications.waBodyHash': waBodyHash,
      'polygonCertifications.whatsappPending': FieldValue.delete(),
      'polygonCertifications.updatedAt': new Date(),
    });
    return txHash;
  } catch (e) {
    const extracted = extractPolygonTxHashFromError(e);
    if (extracted) {
      await mailRef
        .update({
          'polygonCertifications.whatsapp': extracted,
          'polygonCertifications.whatsappPending': FieldValue.delete(),
          'polygonCertifications.updatedAt': new Date(),
        })
        .catch(() => {});
    } else if (shouldReleaseHitoPending(e, extracted)) {
      await mailRef
        .update({
          'polygonCertifications.whatsappPending': FieldValue.delete(),
          'polygonCertifications.updatedAt': new Date(),
        })
        .catch(() => {});
    }
    throw e;
  }
}

export async function certificarUsuario(userId: string, email: string): Promise<string> {
  const timestamp = new Date().toISOString();
  const payload = `USER_CREATED|${userId}|${email}|${timestamp}`;

  console.log('👤 Certificando creación de usuario:', { userId, email });

  const txHash = await sendPolygonTransaction(payload);

  await persistBlockchainMovement(
    {
      type: 'user_created',
      userId,
      email,
      txHash,
      payload,
      status: blockchainMovementStatusForHash(),
    },
    txHash,
    'user_created'
  );
  scheduleMovementMined(txHash);

  console.log('✅ Usuario certificado en Polygon:', txHash);
  return txHash;
}
