import { ethers } from 'ethers';

// Configuración de Polygon Mainnet - Red real con POL
// Chain ID: 137 | Explorer: https://polygonscan.com
const PUBLIC_NODE_RPC = 'https://polygon-bor-rpc.publicnode.com';

// URLs muertas o que requieren API key - usar fallback público
const DEAD_RPC_PATTERNS = [
  'blastapi.io',
  'polygon-rpc.com', // requiere API key
];

function getProviderUrl(): string {
  const envUrl = process.env.POLYGON_PROVIDER_URL?.trim();
  if (!envUrl) return PUBLIC_NODE_RPC;
  const isDead = DEAD_RPC_PATTERNS.some((p) => envUrl.toLowerCase().includes(p));
  return isDead ? PUBLIC_NODE_RPC : envUrl;
}

const provider = new ethers.JsonRpcProvider(getProviderUrl());

// Asegurar formato correcto: con 0x, sin duplicarlo (MetaMask puede exportar con o sin 0x)
function normalizePrivateKey(key: string): string {
  const trimmed = key.trim().replace(/^0x/i, '');
  return trimmed ? `0x${trimmed}` : '';
}

// Wallet creada dinámicamente para leer siempre la variable más reciente (evita caché de módulo)
function getWalletInstance(): ethers.Wallet | null {
  const rawKey = process.env.POLYGON_PRIVATE_KEY?.trim();
  if (!rawKey) return null;
  return new ethers.Wallet(normalizePrivateKey(rawKey), provider);
}

/**
 * Envía una transacción a la red Polygon Mainnet con datos certificados
 * @param data - Datos a certificar en la blockchain
 * @returns Promise<string> - Hash de la transacción
 */
export async function sendPolygonTransaction(data: string): Promise<string> {
  try {
    // Validar que las variables de entorno estén configuradas
    if (!process.env.POLYGON_PRIVATE_KEY || !process.env.POLYGON_PROVIDER_URL || !process.env.POLYGON_WALLET_ADDRESS) {
      throw new Error('❌ Variables de entorno de Polygon no configuradas. Configura POLYGON_PRIVATE_KEY, POLYGON_PROVIDER_URL y POLYGON_WALLET_ADDRESS en .env.local');
    }

    const wallet = getWalletInstance();
    if (!wallet) {
      throw new Error('❌ Wallet no inicializada. Verifica POLYGON_PRIVATE_KEY');
    }

    console.log('🔗 Enviando transacción a Polygon Mainnet:', data);
    console.log('📍 Wallet:', wallet.address);
    console.log('📍 Chain ID:', await provider.getNetwork().then(n => n.chainId)); // Debería ser 137

    // Verificar balance antes de enviar
    const balance = await provider.getBalance(wallet.address);
    console.log('💰 Balance actual:', ethers.formatEther(balance), 'POL');

    if (balance === BigInt(0)) {
      throw new Error('❌ Sin balance POL. Necesitas POL en tu wallet (ej. desde Binance u otro exchange)');
    }

    const tx = await wallet.sendTransaction({
      to: process.env.POLYGON_WALLET_ADDRESS,
      value: 0, // Sin transferencia de POL
      data: ethers.hexlify(ethers.toUtf8Bytes(data)), // Datos certificados
      gasLimit: 100000,
    });

    console.log('⏳ Transacción enviada a Polygon Mainnet, esperando confirmación...', tx.hash);
    console.log('🔍 Ver en explorer: https://polygonscan.com/tx/' + tx.hash);

    // Esperar confirmación de la transacción
    const receipt = await tx.wait();
    
    console.log('✅ Transacción confirmada en Polygon Mainnet:', tx.hash);
    console.log('📊 Gas usado:', receipt?.gasUsed.toString());
    return tx.hash; // Devolver el hash para guardar en Firestore
  } catch (error: any) {
    console.error('❌ Error al enviar transacción a Polygon Mainnet:', error);
    if (error.code === 'INSUFFICIENT_FUNDS') {
      throw new Error('❌ Fondos insuficientes. Necesitas POL en tu wallet (ej. desde Binance)');
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
      timestamp: receipt?.blockNumber ? (await provider.getBlock(receipt.blockNumber))?.timestamp : undefined,
      data: tx?.data ? ethers.toUtf8String(tx.data) : null,
      network: 'Polygon Mainnet',
      chainId: 137,
      explorerUrl: `https://polygonscan.com/tx/${txHash}`
    };
  } catch (error) {
    console.error('❌ Error al obtener información de transacción:', error);
    throw error;
  }
}

/**
 * Obtiene la dirección de la wallet configurada (la que firma y paga gas)
 * @returns string | null - Dirección o null si no está configurada
 */
export function getWalletAddress(): string | null {
  return getWalletInstance()?.address ?? null;
}

/**
 * Verifica el balance de POL de la wallet
 * @returns Promise<string> - Balance en POL
 */
export async function getWalletBalance(): Promise<string> {
  try {
    const wallet = getWalletInstance();
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
 * Obtiene información de la red Polygon Mainnet
 * @returns Promise<any> - Información de la red
 */
export async function getNetworkInfo() {
  try {
    const network = await provider.getNetwork();
    const blockNumber = await provider.getBlockNumber();
    const gasPrice = await provider.getFeeData();
    
    return {
      name: 'Polygon Mainnet',
      chainId: Number(network.chainId), // Debería ser 137
      blockNumber,
      gasPrice: gasPrice.gasPrice ? ethers.formatUnits(gasPrice.gasPrice, 'gwei') : null,
      currency: 'POL',
      explorerUrl: 'https://polygonscan.com'
    };
  } catch (error) {
    console.error('❌ Error al obtener información de red:', error);
    throw error;
  }
}