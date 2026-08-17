import { FieldValue } from 'firebase-admin/firestore';
import { sendPolygonTransaction } from './blockchain';
import { getAdminDb } from './firebase-admin';
import { buildWhatsAppOnChainPayload, hashWhatsAppBody } from './whatsapp-evidence';

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
    await getAdminDb().collection('blockchain_movements').add({
      ...fields,
      timestamp: FieldValue.serverTimestamp(),
      status: 'confirmed',
    });
  } catch (e) {
    console.error(
      `❌ No se pudo registrar movimiento en Firestore (${context}). TX en cadena ya confirmada:`,
      txHash,
      e
    );
  }
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
  via?: string;
}): Promise<string> {
  const { messageId, userId, hito, sendTxHash, contentHash, via } = opts;
  const timestamp = new Date().toISOString();
  const parts = [HITO_PREFIX[hito], messageId, userId];
  if (contentHash) parts.push(contentHash);
  if (via) parts.push(`via:${via}`);
  if (sendTxHash) parts.push(`ref:${sendTxHash}`);
  parts.push(timestamp);
  const payload = parts.join('|');

  console.log(`🔗 Certificando hito ${hito}:`, { messageId, userId, via: via ?? null });

  const txHash = await sendPolygonTransaction(payload);

  await persistBlockchainMovement(
    {
      type: hito,
      userId,
      messageId,
      txHash,
      payload,
      sendTxHash: sendTxHash ?? null,
      contentHash: contentHash ?? null,
      via: via ?? null,
    },
    txHash,
    hito
  );

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
  const db = getAdminDb();
  const mailRef = db.collection('mail').doc(docId);

  const claim = await db.runTransaction(async (t) => {
    const snap = await t.get(mailRef);
    const data = snap.data();
    if (!data || data.campaignId) return { action: 'skip' as const, txHash: null as string | null };

    const existing = (data.polygonCertifications || {}) as Record<string, unknown>;
    const already = existing[field];
    if (typeof already === 'string' && already) {
      return { action: 'exists' as const, txHash: already };
    }
    if (existing[pendingField]) {
      return { action: 'pending' as const, txHash: null as string | null };
    }

    const recipientId =
      data.recipientEmail ||
      (Array.isArray(data.to) ? data.to[0] : data.to) ||
      'recipient';

    t.update(mailRef, {
      [`polygonCertifications.${pendingField}`]: true,
      'polygonCertifications.updatedAt': new Date(),
    });

    return {
      action: 'claim' as const,
      txHash: null as string | null,
      recipientId: String(recipientId),
      sendTxHash: existing.send as string | undefined,
      contentHash: existing.contentHash as string | undefined,
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
      via,
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
    await mailRef
      .update({
        [`polygonCertifications.${pendingField}`]: FieldValue.delete(),
        'polygonCertifications.updatedAt': new Date(),
      })
      .catch(() => {});
    throw e;
  }
}

export async function certificarLectura(messageId: string, userId: string): Promise<string> {
  const timestamp = new Date().toISOString();
  const payload = `READ|${messageId}|${userId}|${timestamp}`;

  console.log('📖 Certificando lectura de mensaje:', { messageId, userId });

  const txHash = await sendPolygonTransaction(payload);

  await persistBlockchainMovement(
    { type: 'read', userId, messageId, txHash, payload },
    txHash,
    'read'
  );

  console.log('✅ Lectura certificada en Polygon:', txHash);
  return txHash;
}

export async function certificarEnvio(
  messageId: string,
  fromUserId: string,
  toEmail: string,
  contentHash?: string,
  smtpMessageId?: string,
): Promise<string> {
  const timestamp = new Date().toISOString();

  // smtpMessageId vincula la TX de Polygon con el registro del servidor SMTP —
  // permite cruzar con los logs del proveedor de correo si el juez lo requiere.
  const parts = ['SEND', messageId, fromUserId, toEmail];
  if (contentHash) parts.push(contentHash);
  if (smtpMessageId) parts.push(`smtp:${smtpMessageId}`);
  parts.push(timestamp);
  const payload = parts.join('|');

  console.log('📤 Certificando envío de mensaje:', {
    messageId,
    fromUserId,
    toEmail,
    contentHash: !!contentHash,
    smtpMessageId: !!smtpMessageId,
  });

  const txHash = await sendPolygonTransaction(payload);

  await persistBlockchainMovement(
    {
      type: 'send',
      userId: fromUserId,
      messageId,
      toEmail,
      contentHash: contentHash ?? null,
      smtpMessageId: smtpMessageId ?? null,
      txHash,
      payload,
    },
    txHash,
    'send'
  );

  console.log('✅ Envío certificado en Polygon:', txHash);
  return txHash;
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
    },
    txHash,
    'certificate'
  );

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
    },
    txHash,
    'first_read'
  );

  console.log('✅ Primera lectura certificada en Polygon:', txHash);
  return txHash;
}

export async function certificarWhatsApp(opts: {
  mailId: string;
  wamid: string;
  waBodyHash: string;
  templateName: string;
  to: string;
}): Promise<{ txHash: string; payload: string }> {
  const timestamp = new Date().toISOString();
  const payload = buildWhatsAppOnChainPayload({
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
    },
    txHash,
    'whatsapp'
  );

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
    if (!snap.exists) return { action: 'skip' as const };
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
      return { action: 'campaign' as const };
    }

    const already = existing.whatsapp;
    if (typeof already === 'string' && already) {
      if (Object.keys(patch).length > 1) t.update(mailRef, patch);
      return { action: 'exists' as const, txHash: already };
    }
    if (existing.whatsappPending) {
      return { action: 'pending' as const };
    }
    if (!waBodyHash || !wamid) {
      if (Object.keys(patch).length > 1) t.update(mailRef, patch);
      return { action: 'skip' as const };
    }

    t.update(mailRef, {
      ...patch,
      'polygonCertifications.whatsappPending': true,
    });

    return { action: 'claim' as const };
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
    await mailRef
      .update({
        'polygonCertifications.whatsappPending': FieldValue.delete(),
        'polygonCertifications.updatedAt': new Date(),
      })
      .catch(() => {});
    throw e;
  }
}

export async function certificarUsuario(userId: string, email: string): Promise<string> {
  const timestamp = new Date().toISOString();
  const payload = `USER_CREATED|${userId}|${email}|${timestamp}`;

  console.log('👤 Certificando creación de usuario:', { userId, email });

  const txHash = await sendPolygonTransaction(payload);

  await persistBlockchainMovement(
    { type: 'user_created', userId, email, txHash, payload },
    txHash,
    'user_created'
  );

  console.log('✅ Usuario certificado en Polygon:', txHash);
  return txHash;
}
