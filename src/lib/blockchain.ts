import { ethers } from 'ethers';

// Configuración de Polygon Amoy Testnet (2025) - Reemplaza Mumbai deprecado
// Mumbai fue descontinuado el 13 abril 2024 - Amoy es el reemplazo oficial
const provider = new ethers.JsonRpcProvider(process.env.POLYGON_PROVIDER_URL || 'https://rpc-amoy.polygon.technology/');
const wallet = process.env.POLYGON_PRIVATE_KEY 
  ? new ethers.Wallet(`0x${process.env.POLYGON_PRIVATE_KEY}`, provider)
  : null;

/**
 * Envía una transacción a la red Polygon Amoy con datos certificados
 * @param data - Datos a certificar en la blockchain
 * @returns Promise<string> - Hash de la transacción
 */
export async function sendPolygonTransaction(data: string): Promise<string> {
  try {
    // Validar que las variables de entorno estén configuradas
    if (!process.env.POLYGON_PRIVATE_KEY || !process.env.POLYGON_PROVIDER_URL || !process.env.POLYGON_WALLET_ADDRESS) {
      throw new Error('❌ Variables de entorno de Polygon no configuradas. Configura POLYGON_PRIVATE_KEY, POLYGON_PROVIDER_URL y POLYGON_WALLET_ADDRESS en .env.local');
    }

    if (!wallet) {
      throw new Error('❌ Wallet no inicializada. Verifica POLYGON_PRIVATE_KEY');
    }

    console.log('🔗 Enviando transacción a Polygon Amoy Testnet:', data);
    console.log('📍 Chain ID:', await provider.getNetwork().then(n => n.chainId)); // Debería ser 80002

    // Verificar balance antes de enviar
    const balance = await provider.getBalance(wallet.address);
    console.log('💰 Balance actual:', ethers.formatEther(balance), 'POL');

    if (balance === 0n) {
      throw new Error('❌ Sin balance POL. Obtén tokens en: https://www.alchemy.com/faucets/polygon-amoy');
    }

    const tx = await wallet.sendTransaction({
      to: process.env.POLYGON_WALLET_ADDRESS,
      value: 0, // Sin transferencia de POL
      data: ethers.toUtf8Bytes(data), // Datos certificados
      gasLimit: 100000, // Gas límite aumentado para Amoy
    });

    console.log('⏳ Transacción enviada a Amoy, esperando confirmación...', tx.hash);
    console.log('🔍 Ver en explorer: https://amoy.polygonscan.com/tx/' + tx.hash);

    // Esperar confirmación de la transacción
    const receipt = await tx.wait();
    
    console.log('✅ Transacción confirmada en Polygon Amoy:', tx.hash);
    console.log('📊 Gas usado:', receipt?.gasUsed.toString());
    return tx.hash; // Devolver el hash para guardar en Firestore
  } catch (error: any) {
    console.error('❌ Error al enviar transacción a Polygon Amoy:', error);
    if (error.code === 'INSUFFICIENT_FUNDS') {
      throw new Error('❌ Fondos insuficientes. Obtén POL gratis en: https://www.alchemy.com/faucets/polygon-amoy');
    }
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
      data: tx?.data ? ethers.toUtf8String(tx.data) : null,
      network: 'Polygon Amoy Testnet',
      chainId: 80002,
      explorerUrl: `https://amoy.polygonscan.com/tx/${txHash}`
    };
  } catch (error) {
    console.error('❌ Error al obtener información de transacción:', error);
    throw error;
  }
}

/**
 * Verifica el balance de POL de la wallet
 * @returns Promise<string> - Balance en POL
 */
export async function getWalletBalance(): Promise<string> {
  try {
    if (!wallet) {
      throw new Error('❌ Wallet no configurada');
    }
    const balance = await provider.getBalance(wallet.address);
    return ethers.formatEther(balance);
  } catch (error) {
    console.error('❌ Error al obtener balance:', error);
    throw error;
  }
}

/**
 * Obtiene información de la red Polygon Amoy
 * @returns Promise<any> - Información de la red
 */
export async function getNetworkInfo() {
  try {
    const network = await provider.getNetwork();
    const blockNumber = await provider.getBlockNumber();
    const gasPrice = await provider.getFeeData();
    
    return {
      name: 'Polygon Amoy Testnet',
      chainId: Number(network.chainId), // Debería ser 80002
      blockNumber,
      gasPrice: gasPrice.gasPrice ? ethers.formatUnits(gasPrice.gasPrice, 'gwei') : null,
      currency: 'POL',
      explorerUrl: 'https://amoy.polygonscan.com',
      faucetUrl: 'https://www.alchemy.com/faucets/polygon-amoy'
    };
  } catch (error) {
    console.error('❌ Error al obtener información de red:', error);
    throw error;
  }
}