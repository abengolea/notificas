import { ethers } from 'ethers';

// Configuración de Polygon (Mumbai Testnet para desarrollo)
const provider = new ethers.JsonRpcProvider(process.env.POLYGON_PROVIDER_URL);
const wallet = new ethers.Wallet(`0x${process.env.POLYGON_PRIVATE_KEY}`, provider);

/**
 * Envía una transacción a la red Polygon con datos certificados
 * @param data - Datos a certificar en la blockchain
 * @returns Promise<string> - Hash de la transacción
 */
export async function sendPolygonTransaction(data: string): Promise<string> {
  try {
    // Validar que las variables de entorno estén configuradas
    if (!process.env.POLYGON_PRIVATE_KEY || !process.env.POLYGON_PROVIDER_URL || !process.env.POLYGON_WALLET_ADDRESS) {
      throw new Error('❌ Variables de entorno de Polygon no configuradas');
    }

    console.log('🔗 Enviando transacción a Polygon:', data);

    const tx = await wallet.sendTransaction({
      to: process.env.POLYGON_WALLET_ADDRESS,
      value: 0, // Sin transferencia de MATIC
      data: ethers.toUtf8Bytes(data), // Datos certificados
    });

    console.log('⏳ Transacción enviada, esperando confirmación...', tx.hash);

    // Esperar confirmación de la transacción
    await tx.wait();
    
    console.log('✅ Transacción confirmada en Polygon:', tx.hash);
    return tx.hash; // Devolver el hash para guardar en Firestore
  } catch (error) {
    console.error('❌ Error al enviar transacción a Polygon:', error);
    throw error;
  }
}

/**
 * Obtiene información de una transacción por su hash
 * @param txHash - Hash de la transacción
 * @returns Promise<any> - Información de la transacción
 */
export async function getTransactionInfo(txHash: string) {
  try {
    const tx = await provider.getTransaction(txHash);
    const receipt = await provider.getTransactionReceipt(txHash);
    
    return {
      hash: tx?.hash,
      blockNumber: receipt?.blockNumber,
      gasUsed: receipt?.gasUsed,
      status: receipt?.status,
      timestamp: tx?.timestamp,
      data: tx?.data ? ethers.toUtf8String(tx.data) : null
    };
  } catch (error) {
    console.error('❌ Error al obtener información de transacción:', error);
    throw error;
  }
}

/**
 * Verifica el balance de MATIC de la wallet
 * @returns Promise<string> - Balance en MATIC
 */
export async function getWalletBalance(): Promise<string> {
  try {
    const balance = await provider.getBalance(wallet.address);
    return ethers.formatEther(balance);
  } catch (error) {
    console.error('❌ Error al obtener balance:', error);
    throw error;
  }
}