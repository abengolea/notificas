import { sendPolygonTransaction } from './blockchain';
import { db } from './firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

/**
 * Certifica la lectura de un mensaje en la blockchain
 * @param messageId - ID del mensaje leído
 * @param userId - ID del usuario que leyó
 * @returns Promise<string> - Hash de la transacción
 */
export async function certificarLectura(messageId: string, userId: string): Promise<string> {
  try {
    const timestamp = new Date().toISOString();
    const payload = `READ|${messageId}|${userId}|${timestamp}`;
    
    console.log('📖 Certificando lectura de mensaje:', { messageId, userId });
    
    // Enviar transacción a Polygon
    const txHash = await sendPolygonTransaction(payload);
    
    // Guardar en Firestore para trazabilidad
    await addDoc(collection(db, 'blockchain_movements'), {
      type: 'read',
      userId,
      messageId,
      timestamp: serverTimestamp(),
      txHash,
      payload,
      status: 'confirmed'
    });

    console.log('✅ Lectura certificada en Polygon:', txHash);
    return txHash;
  } catch (error) {
    console.error('❌ Error al certificar lectura:', error);
    throw error;
  }
}

/**
 * Certifica el envío de un mensaje en la blockchain
 * @param messageId - ID del mensaje enviado
 * @param fromUserId - ID del remitente
 * @param toEmail - Email del destinatario
 * @returns Promise<string> - Hash de la transacción
 */
export async function certificarEnvio(messageId: string, fromUserId: string, toEmail: string): Promise<string> {
  try {
    const timestamp = new Date().toISOString();
    const payload = `SEND|${messageId}|${fromUserId}|${toEmail}|${timestamp}`;
    
    console.log('📤 Certificando envío de mensaje:', { messageId, fromUserId, toEmail });
    
    // Enviar transacción a Polygon
    const txHash = await sendPolygonTransaction(payload);
    
    // Guardar en Firestore
    await addDoc(collection(db, 'blockchain_movements'), {
      type: 'send',
      userId: fromUserId,
      messageId,
      toEmail,
      timestamp: serverTimestamp(),
      txHash,
      payload,
      status: 'confirmed'
    });

    console.log('✅ Envío certificado en Polygon:', txHash);
    return txHash;
  } catch (error) {
    console.error('❌ Error al certificar envío:', error);
    throw error;
  }
}

/**
 * Certifica la recepción de un mensaje en la blockchain
 * @param messageId - ID del mensaje recibido
 * @param userId - ID del usuario que recibió
 * @returns Promise<string> - Hash de la transacción
 */
export async function certificarRecepcion(messageId: string, userId: string): Promise<string> {
  try {
    const timestamp = new Date().toISOString();
    const payload = `RECEIVE|${messageId}|${userId}|${timestamp}`;
    
    console.log('📨 Certificando recepción de mensaje:', { messageId, userId });
    
    // Enviar transacción a Polygon
    const txHash = await sendPolygonTransaction(payload);
    
    // Guardar en Firestore
    await addDoc(collection(db, 'blockchain_movements'), {
      type: 'receive',
      userId,
      messageId,
      timestamp: serverTimestamp(),
      txHash,
      payload,
      status: 'confirmed'
    });

    console.log('✅ Recepción certificada en Polygon:', txHash);
    return txHash;
  } catch (error) {
    console.error('❌ Error al certificar recepción:', error);
    throw error;
  }
}

/**
 * Certifica la creación de un usuario en la blockchain
 * @param userId - ID del usuario creado
 * @param email - Email del usuario
 * @returns Promise<string> - Hash de la transacción
 */
export async function certificarUsuario(userId: string, email: string): Promise<string> {
  try {
    const timestamp = new Date().toISOString();
    const payload = `USER_CREATED|${userId}|${email}|${timestamp}`;
    
    console.log('👤 Certificando creación de usuario:', { userId, email });
    
    // Enviar transacción a Polygon
    const txHash = await sendPolygonTransaction(payload);
    
    // Guardar en Firestore
    await addDoc(collection(db, 'blockchain_movements'), {
      type: 'user_created',
      userId,
      email,
      timestamp: serverTimestamp(),
      txHash,
      payload,
      status: 'confirmed'
    });

    console.log('✅ Usuario certificado en Polygon:', txHash);
    return txHash;
  } catch (error) {
    console.error('❌ Error al certificar usuario:', error);
    throw error;
  }
}