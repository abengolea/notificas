import { FieldValue } from 'firebase-admin/firestore';
import { sendPolygonTransaction } from './blockchain';
import { getAdminDb } from './firebase-admin';

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
