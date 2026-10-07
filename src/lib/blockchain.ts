import { randomUUID } from 'crypto';
import { ethers } from 'ethers';
import { getAdminDb } from './firebase-admin';
import {
  WALLET_LOCK_TTL_MS,
  canReleaseWalletLock,
  hashPolygonPayload,
  isAlreadyKnownTxError,
  isReplacementUnderpriced,
  isTransientPolygonRpcError,
  isWalletLockBusy,
  resolveNextNonce,
  resolvePolygonRpcUrls,
} from './polygon-send-logic';

const WALLET_STATE_DOC = 'system/polygon_wallet';
const LOCK_RETRIES = 5;
const GAS_LIMIT_FALLBACK = BigInt(100000);
const GAS_LIMIT_MARGIN_NUM = BigInt(12);
const GAS_LIMIT_MARGIN_DEN = BigInt(10);
const RECOVERY_BLOCK_WINDOW = 50;
const MINED_POLL_MS = 4_000;
const MINED_POLL_ATTEMPTS = 45;

const rpcUrls = resolvePolygonRpcUrls(process.env.POLYGON_PROVIDER_URL);

function jsonRpc(url: string): ethers.JsonRpcProvider {
  return new ethers.JsonRpcProvider(url, 137, { staticNetwork: true });
}

const provider = new ethers.FallbackProvider(
  rpcUrls.map((url, index) => ({
    provider: jsonRpc(url),
    priority: index + 1,
    stallTimeout: 2_000,
    weight: 1,
  })),
  137,
  { quorum: 1 }
);

function normalizePrivateKey(key: string): string {
  const trimmed = key.trim().replace(/^0x/i, '');
  return trimmed ? `0x${trimmed}` : '';
}

let cachedKey = '';
let cachedWallet: ethers.Wallet | null = null;
let sendQueue: Promise<unknown> = Promise.resolve();

function getWalletInstance(): ethers.Wallet | null {
  const rawKey = process.env.POLYGON_PRIVATE_KEY?.trim();
  if (!rawKey) {
    cachedKey = '';
    cachedWallet = null;
    return null;
  }
  const normalized = normalizePrivateKey(rawKey);
  if (cachedWallet && cachedKey === normalized) return cachedWallet;
  cachedWallet = new ethers.Wallet(normalized, provider);
  cachedKey = normalized;
  return cachedWallet;
}

function enqueueSend<T>(task: () => Promise<T>): Promise<T> {
  const next = sendQueue.then(task, task);
  sendQueue = next.then(() => undefined, () => undefined);
  return next;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function walletStateRef() {
  return getAdminDb().doc(WALLET_STATE_DOC);
}

type WalletState = {
  lockOwner?: string | null;
  lockedAt?: number | null;
  expiresAt?: number | null;
  lastBroadcastNonce?: number | null;
  lastBroadcastTxHash?: string | null;
  lastBroadcastAt?: number | null;
  lastStatus?: string | null;
  lastError?: string | null;
  reservedNonce?: number | null;
  reservedPayloadHash?: string | null;
  reservedCertRef?: string | null;
  reservedAt?: number | null;
};

export type PolygonBroadcastRequest = {
  data: string;
  certificationId: string;
  kind: string;
  entityId: string;
};

export type PolygonBroadcastResult = {
  hash: string;
  nonce: number;
};

function polygonLog(event: string, fields: Record<string, unknown>): void {
  console.log(
    JSON.stringify({
      msg: 'polygon_sender',
      event,
      ...fields,
    })
  );
}

function asInt(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) ? value : null;
}

async function acquireWalletLock(lockId: string): Promise<WalletState> {
  const ref = walletStateRef();
  return getAdminDb().runTransaction(async (t) => {
    const snap = await t.get(ref);
    const current = (snap.data() || {}) as WalletState;
    const now = Date.now();
    if (
      isWalletLockBusy({
        lockOwner: current.lockOwner,
        expiresAt: current.expiresAt,
        nowMs: now,
        myLockId: lockId,
      })
    ) {
      throw new Error('POLYGON_WALLET_BUSY');
    }
    const next: WalletState = {
      ...current,
      lockOwner: lockId,
      lockedAt: now,
      expiresAt: now + WALLET_LOCK_TTL_MS,
    };
    t.set(ref, next, { merge: true });
    return next;
  });
}

async function releaseWalletLock(lockId: string): Promise<void> {
  const ref = walletStateRef();
  await getAdminDb().runTransaction(async (t) => {
    const snap = await t.get(ref);
    const current = (snap.data() || {}) as WalletState;
    if (!canReleaseWalletLock(current.lockOwner, lockId)) return;
    t.set(
      ref,
      {
        lockOwner: null,
        lockedAt: null,
        expiresAt: null,
      },
      { merge: true }
    );
  });
}

async function withWalletLock<T>(fn: (lockId: string, state: WalletState) => Promise<T>): Promise<T> {
  const lockId = randomUUID();
  let lastError: unknown;
  for (let attempt = 0; attempt < LOCK_RETRIES; attempt++) {
    try {
      const state = await acquireWalletLock(lockId);
      try {
        return await fn(lockId, state);
      } finally {
        await releaseWalletLock(lockId).catch((e) => {
          console.warn('⚠️ polygon lock release failed:', e instanceof Error ? e.message : e);
        });
      }
    } catch (error) {
      lastError = error;
      const busy = error instanceof Error && error.message === 'POLYGON_WALLET_BUSY';
      if (!busy || attempt === LOCK_RETRIES - 1) throw error;
      await sleep(200 * 2 ** attempt);
    }
  }
  throw lastError instanceof Error ? lastError : new Error('POLYGON_WALLET_BUSY');
}

async function inspectTx(txHash: string): Promise<'mined' | 'pending' | 'dropped'> {
  const receipt = await provider.getTransactionReceipt(txHash);
  if (receipt) return 'mined';
  const tx = await provider.getTransaction(txHash);
  if (tx) return 'pending';
  return 'dropped';
}

async function findTxByNonce(address: string, nonce: number): Promise<string | null> {
  const current = await provider.getBlockNumber();
  const from = Math.max(0, current - RECOVERY_BLOCK_WINDOW);
  const addr = address.toLowerCase();
  for (let n = current; n >= from; n--) {
    const block = await provider.getBlock(n, true);
    if (!block) continue;
    for (const tx of block.prefetchedTransactions) {
      if (tx.from.toLowerCase() === addr && tx.nonce === nonce) return tx.hash;
    }
  }
  return null;
}

function watchMined(txHash: string, fields: Record<string, unknown>): void {
  void waitForPolygonMined(txHash)
    .then(async (mined) => {
      if (!mined) return;
      polygonLog('mined', {
        ...fields,
        txHash,
        status: 'mined',
      });
      await walletStateRef().set({ lastStatus: 'mined' }, { merge: true });
    })
    .catch((e) => {
      polygonLog('wait_error', {
        ...fields,
        txHash,
        errorCode: e instanceof Error ? e.message : String(e),
      });
    });
}

async function broadcastSignedTx(signed: string, txHash: string): Promise<void> {
  let lastError: unknown;
  for (const url of rpcUrls) {
    try {
      await jsonRpc(url).broadcastTransaction(signed);
      polygonLog('broadcast_rpc', { rpc: url, txHash, status: 'broadcast' });
      return;
    } catch (error) {
      if (isAlreadyKnownTxError(error)) {
        polygonLog('broadcast_rpc', { rpc: url, txHash, status: 'already_known' });
        return;
      }
      lastError = error;
      if (!isTransientPolygonRpcError(error)) throw error;
      polygonLog('broadcast_rpc_retry', {
        rpc: url,
        txHash,
        errorCode: error instanceof Error ? error.message : String(error),
      });
    }
  }
  throw lastError instanceof Error ? lastError : new Error('POLYGON_RPC_UNAVAILABLE');
}

async function broadcastOnce(
  req: PolygonBroadcastRequest,
  lockId: string,
  state: WalletState
): Promise<PolygonBroadcastResult> {
  if (!process.env.POLYGON_PRIVATE_KEY || !process.env.POLYGON_PROVIDER_URL || !process.env.POLYGON_WALLET_ADDRESS) {
    throw new Error(
      '❌ Variables de entorno de Polygon no configuradas. Configura POLYGON_PRIVATE_KEY, POLYGON_PROVIDER_URL y POLYGON_WALLET_ADDRESS en .env.local'
    );
  }
  const wallet = getWalletInstance();
  if (!wallet) {
    throw new Error('❌ Wallet no inicializada. Verifica POLYGON_PRIVATE_KEY');
  }

  const address = wallet.address;
  const payloadHash = hashPolygonPayload(req.data);
  const to = process.env.POLYGON_WALLET_ADDRESS as string;
  const txData = ethers.hexlify(ethers.toUtf8Bytes(req.data));

  const latest = await provider.getTransactionCount(address, 'latest');
  const pending = await provider.getTransactionCount(address, 'pending');

  let reservedNonce = asInt(state.reservedNonce);
  let reservedHasTxHash = false;
  const lastHash = typeof state.lastBroadcastTxHash === 'string' ? state.lastBroadcastTxHash : null;
  const lastNonce = asInt(state.lastBroadcastNonce);

  if (lastHash) {
    const chainStatus = await inspectTx(lastHash);
    if (chainStatus === 'pending') {
      polygonLog('previous_pending', {
        certificationId: req.certificationId,
        wallet: address,
        nonce: lastNonce,
        txHash: lastHash,
        latestNonce: latest,
        pendingNonce: pending,
        lockOwner: lockId,
        status: 'pending',
      });
      throw new Error(`POLYGON_TX_STILL_PENDING:${lastHash}`);
    }
    if (chainStatus === 'mined') {
      reservedNonce = null;
    }
    if (chainStatus === 'dropped' && lastNonce != null) {
      reservedNonce = lastNonce;
      reservedHasTxHash = false;
    }
  }

  if (reservedNonce != null && !lastHash) {
    if (latest > reservedNonce) {
      const recovered = await findTxByNonce(address, reservedNonce);
      if (recovered) {
        const reservedForUs = !state.reservedCertRef || state.reservedCertRef === req.certificationId;
        polygonLog('recovered_hash', {
          certificationId: req.certificationId,
          reservedCertRef: state.reservedCertRef || null,
          wallet: address,
          nonce: reservedNonce,
          txHash: recovered,
          latestNonce: latest,
          pendingNonce: pending,
          status: 'mined',
        });
        await walletStateRef().set(
          {
            lastBroadcastNonce: reservedNonce,
            lastBroadcastTxHash: recovered,
            lastBroadcastAt: Date.now(),
            lastStatus: 'mined',
            reservedNonce: null,
            reservedPayloadHash: null,
            reservedCertRef: null,
            reservedAt: null,
          },
          { merge: true }
        );
        if (reservedForUs) {
          return { hash: recovered, nonce: reservedNonce };
        }
        reservedNonce = null;
      }
    }
    if (pending > latest) {
      polygonLog('reserved_mempool', {
        certificationId: req.certificationId,
        wallet: address,
        nonce: reservedNonce,
        latestNonce: latest,
        pendingNonce: pending,
        status: 'pending',
      });
      throw new Error(`POLYGON_TX_STILL_PENDING:nonce:${reservedNonce}`);
    }
  }

  const resolved = resolveNextNonce({
    latest,
    pending,
    lastBroadcastNonce: lastNonce,
    reservedNonce,
    reservedHasTxHash,
  });
  const nonce = resolved.nonce;

  await walletStateRef().set(
    {
      reservedNonce: nonce,
      reservedPayloadHash: payloadHash,
      reservedCertRef: req.certificationId,
      reservedAt: Date.now(),
      lastError: null,
    },
    { merge: true }
  );

  const balance = await provider.getBalance(address);
  polygonLog('broadcast_prepare', {
    certificationId: req.certificationId,
    kind: req.kind,
    entityId: req.entityId,
    wallet: address,
    nonce,
    latestNonce: latest,
    pendingNonce: pending,
    payloadHash,
    reuseReserved: resolved.reuseReserved,
    lockOwner: lockId,
    status: 'reserved',
  });

  if (balance === BigInt(0)) {
    throw new Error('❌ Sin balance POL. Necesitas POL en tu wallet (ej. desde Binance u otro exchange)');
  }

  let gasLimit = GAS_LIMIT_FALLBACK;
  try {
    const estimated = await wallet.estimateGas({ to, data: txData, value: 0 });
    gasLimit = (estimated * GAS_LIMIT_MARGIN_NUM) / GAS_LIMIT_MARGIN_DEN;
  } catch {
    gasLimit = GAS_LIMIT_FALLBACK;
  }

  let txHash: string;
  try {
    const populated = await wallet.populateTransaction({
      to,
      value: 0,
      data: txData,
      nonce,
      gasLimit,
      chainId: 137,
    });
    const signed = await wallet.signTransaction(populated);
    const parsed = ethers.Transaction.from(signed);
    if (!parsed.hash) throw new Error('POLYGON_SIGNED_TX_MISSING_HASH');
    txHash = parsed.hash;
    await broadcastSignedTx(signed, txHash);
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string };
    polygonLog('broadcast_error', {
      certificationId: req.certificationId,
      wallet: address,
      nonce,
      latestNonce: latest,
      pendingNonce: pending,
      payloadHash,
      txHash: lastHash,
      errorCode: err?.code || (error instanceof Error ? error.message : String(error)),
      status: 'failed',
    });
    if (isReplacementUnderpriced(error)) {
      throw new Error(
        `REPLACEMENT_UNDERPRICED: nonce ${nonce} en uso (latest=${latest} pending=${pending} lastTx=${lastHash || 'none'} cert=${req.certificationId}). No se reenvía.`
      );
    }
    if (err?.code === 'INSUFFICIENT_FUNDS') {
      throw new Error('❌ Fondos insuficientes. Necesitas POL en tu wallet (ej. desde Binance)');
    }
    await walletStateRef().set(
      {
        lastStatus: 'failed',
        lastError: error instanceof Error ? error.message : String(error),
      },
      { merge: true }
    );
    throw error;
  }

  await walletStateRef().set(
    {
      lastBroadcastNonce: nonce,
      lastBroadcastTxHash: txHash,
      lastBroadcastAt: Date.now(),
      lastStatus: 'broadcast',
      lastError: null,
      reservedNonce: null,
      reservedPayloadHash: null,
      reservedCertRef: null,
      reservedAt: null,
    },
    { merge: true }
  );

  polygonLog('broadcast', {
    certificationId: req.certificationId,
    kind: req.kind,
    entityId: req.entityId,
    wallet: address,
    nonce,
    txHash,
    payloadHash,
    latestNonce: latest,
    pendingNonce: pending,
    status: 'broadcast',
    lockOwner: lockId,
  });

  watchMined(txHash, {
    certificationId: req.certificationId,
    wallet: address,
    nonce,
    payloadHash,
  });

  return { hash: txHash, nonce };
}

export async function broadcastPolygonCertification(
  req: PolygonBroadcastRequest
): Promise<PolygonBroadcastResult> {
  return enqueueSend(() =>
    withWalletLock((lockId, state) => broadcastOnce(req, lockId, state))
  );
}

/**
 * Envía una transacción a Polygon Mainnet.
 * Compatibilidad: callers históricos pasan el payload string.
 * El hash se considera existente desde el broadcast; wait() solo actualiza el estado.
 */
export async function sendPolygonTransaction(data: string): Promise<string> {
  const result = await broadcastPolygonCertification({
    data,
    certificationId: `raw:${hashPolygonPayload(data).slice(0, 16)}`,
    kind: 'raw',
    entityId: '',
  });
  return result.hash;
}

export async function inspectPolygonTx(txHash: string): Promise<'mined' | 'pending' | 'dropped'> {
  return inspectTx(txHash);
}

export async function waitForPolygonMined(txHash: string): Promise<boolean> {
  for (let attempt = 0; attempt < MINED_POLL_ATTEMPTS; attempt++) {
    try {
      if ((await inspectTx(txHash)) === 'mined') return true;
    } catch (error) {
      if (!isTransientPolygonRpcError(error)) throw error;
    }
    await sleep(MINED_POLL_MS);
  }
  try {
    return (await inspectTx(txHash)) === 'mined';
  } catch {
    return false;
  }
}

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
      explorerUrl: `https://polygonscan.com/tx/${txHash}`,
    };
  } catch (error) {
    console.error('❌ Error al obtener información de transacción:', error);
    throw error;
  }
}

export function getWalletAddress(): string | null {
  return getWalletInstance()?.address ?? null;
}

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

export async function getNetworkInfo() {
  try {
    const network = await provider.getNetwork();
    const blockNumber = await provider.getBlockNumber();
    const gasPrice = await provider.getFeeData();

    return {
      name: 'Polygon Mainnet',
      chainId: Number(network.chainId),
      blockNumber,
      gasPrice: gasPrice.gasPrice ? ethers.formatUnits(gasPrice.gasPrice, 'gwei') : null,
      currency: 'POL',
      explorerUrl: 'https://polygonscan.com',
    };
  } catch (error) {
    console.error('❌ Error al obtener información de red:', error);
    throw error;
  }
}
