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
  contentHash?: string
): Promise<string> {
  const timestamp = new Date().toISOString();
  const payload = contentHash
    ? `SEND|${messageId}|${fromUserId}|${toEmail}|${contentHash}|${timestamp}`
    : `SEND|${messageId}|${fromUserId}|${toEmail}|${timestamp}`;

  console.log('📤 Certificando envío de mensaje:', {
    messageId,
    fromUserId,
    toEmail,
    contentHash: !!contentHash,
  });

  const txHash = await sendPolygonTransaction(payload);

  await persistBlockchainMovement(
    {
      type: 'send',
      userId: fromUserId,
      messageId,
      toEmail,
      contentHash: contentHash ?? null,
      txHash,
      payload,
    },
    txHash,
    'send'
  );

  console.log('✅ Envío certificado en Polygon:', txHash);
  return txHash;
}

export async function certificarRecepcion(messageId: string, userId: string): Promise<string> {
  const timestamp = new Date().toISOString();
  const payload = `RECEIVE|${messageId}|${userId}|${timestamp}`;

  console.log('📨 Certificando recepción de mensaje:', { messageId, userId });

  const txHash = await sendPolygonTransaction(payload);

  await persistBlockchainMovement(
    { type: 'receive', userId, messageId, txHash, payload },
    txHash,
    'receive'
  );

  console.log('✅ Recepción certificada en Polygon:', txHash);
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
