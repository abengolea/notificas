import { createHash } from 'crypto';

export const POLYGON_SEND_CERT_PREFIX = 'send:';
export const SEND_CLAIM_TTL_MS = 60_000;
export const WALLET_LOCK_TTL_MS = 30_000;

export type PolygonSendOpStatus =
  | 'reserved'
  | 'broadcast'
  | 'pending'
  | 'mined'
  | 'failed'
  | 'dropped'
  | 'replaced';

export type PolygonSendOperation = {
  certificationId?: string;
  mailId?: string;
  type?: string;
  payload?: string;
  payloadHash?: string;
  timestamp?: string;
  nonce?: number | null;
  txHash?: string | null;
  status?: PolygonSendOpStatus | string;
  createdAt?: unknown;
  broadcastAt?: unknown;
  confirmedAt?: unknown;
  retryCount?: number;
  lastError?: string | null;
  claimOwner?: string | null;
  claimExpiresAt?: number | null;
};

export type RetryCertifyAction = 'skip_wait' | 'skip_done' | 'reconcile' | 'first_cert' | 'recovery';

export function sendCertificationId(mailId: string): string {
  return `${POLYGON_SEND_CERT_PREFIX}${mailId}`;
}

export function isPolygonTxHash(value: unknown): value is string {
  return typeof value === 'string' && /^0x[0-9a-fA-F]{64}$/.test(value);
}

export function hashPolygonPayload(payload: string): string {
  return createHash('sha256').update(payload, 'utf8').digest('hex');
}

export function buildSendOnChainPayload(input: {
  messageId: string;
  fromUserId: string;
  toEmail: string;
  contentHash?: string;
  smtpMessageId?: string;
  timestamp: string;
}): string {
  const parts = ['SEND', input.messageId, input.fromUserId, input.toEmail];
  if (input.contentHash) parts.push(input.contentHash);
  if (input.smtpMessageId) parts.push(`smtp:${input.smtpMessageId}`);
  parts.push(input.timestamp);
  return parts.join('|');
}

export function isReplacementUnderpriced(error: unknown): boolean {
  const e = error as { code?: string; message?: string; shortMessage?: string };
  const blob = `${e?.code || ''} ${e?.shortMessage || ''} ${e?.message || ''}`.toLowerCase();
  return (
    e?.code === 'REPLACEMENT_UNDERPRICED' ||
    blob.includes('replacement transaction underpriced') ||
    blob.includes('replacement fee too low') ||
    blob.includes('replacement_underpriced')
  );
}

export const POLYGON_DEAD_RPC_PATTERNS = ['blastapi.io', 'polygon-rpc.com'] as const;

export const POLYGON_FALLBACK_RPCS = [
  'https://polygon.drpc.org',
  'https://1rpc.io/matic',
  'https://polygon-bor-rpc.publicnode.com',
] as const;

function errorBlob(error: unknown): string {
  const e = error as {
    code?: string | number;
    message?: string;
    shortMessage?: string;
    info?: { responseStatus?: string; requestUrl?: string };
  };
  return `${e?.code || ''} ${e?.shortMessage || ''} ${e?.message || ''} ${e?.info?.responseStatus || ''} ${e?.info?.requestUrl || ''}`.toLowerCase();
}

export function isDeadPolygonRpcUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return POLYGON_DEAD_RPC_PATTERNS.some((p) => lower.includes(p));
}

export function resolvePolygonRpcUrls(envUrl?: string | null): string[] {
  const urls: string[] = [];
  const env = envUrl?.trim().replace(/\/$/, '') || '';
  if (env && !isDeadPolygonRpcUrl(env)) urls.push(env);
  for (const fallback of POLYGON_FALLBACK_RPCS) {
    if (!urls.includes(fallback)) urls.push(fallback);
  }
  return urls;
}

export function isTransientPolygonRpcError(error: unknown): boolean {
  const blob = errorBlob(error);
  return (
    blob.includes('could not reach node') ||
    blob.includes('failed to detect network') ||
    blob.includes('service unavailable') ||
    blob.includes('503') ||
    blob.includes('502') ||
    blob.includes('504') ||
    blob.includes('500 internal') ||
    blob.includes('server_error') ||
    blob.includes('econnreset') ||
    blob.includes('etimedout') ||
    blob.includes('timeout') ||
    blob.includes('network error') ||
    blob.includes('socket hang up')
  );
}

export function isAlreadyKnownTxError(error: unknown): boolean {
  const blob = errorBlob(error);
  return (
    blob.includes('already known') ||
    blob.includes('known transaction') ||
    blob.includes('already imported')
  );
}

export function canReleaseWalletLock(currentOwner: unknown, myLockId: string): boolean {
  return typeof currentOwner === 'string' && currentOwner.length > 0 && currentOwner === myLockId;
}

export function isWalletLockBusy(input: {
  lockOwner: unknown;
  expiresAt: unknown;
  nowMs: number;
  myLockId: string;
}): boolean {
  const owner = typeof input.lockOwner === 'string' ? input.lockOwner : '';
  const expiresAt = typeof input.expiresAt === 'number' ? input.expiresAt : 0;
  if (!owner) return false;
  if (owner === input.myLockId) return false;
  return expiresAt > input.nowMs;
}

export function resolveNextNonce(input: {
  latest: number;
  pending: number;
  lastBroadcastNonce: number | null;
  reservedNonce: number | null;
  reservedHasTxHash: boolean;
}): { nonce: number; reuseReserved: boolean } {
  const latest = Math.max(0, input.latest);
  const pending = Math.max(latest, input.pending);
  if (input.reservedNonce != null && Number.isInteger(input.reservedNonce) && !input.reservedHasTxHash) {
    return { nonce: input.reservedNonce, reuseReserved: true };
  }
  const last = input.lastBroadcastNonce != null && Number.isInteger(input.lastBroadcastNonce)
    ? input.lastBroadcastNonce
    : -1;
  return { nonce: Math.max(pending, last + 1), reuseReserved: false };
}

export function classifyRetryCertifyAction(poly: {
  send?: unknown;
  sendOperation?: PolygonSendOperation | null;
} | null | undefined): RetryCertifyAction {
  const send = isPolygonTxHash(poly?.send) ? poly.send : '';
  const op = poly?.sendOperation || {};
  const status = typeof op.status === 'string' ? op.status : '';
  const opHash = isPolygonTxHash(op.txHash) ? op.txHash : '';
  const txHash = send || opHash;

  if (status === 'pending') return 'skip_wait';
  if (status === 'mined' && txHash) return 'skip_done';
  if (status === 'reserved' && !txHash) return 'recovery';
  if ((status === 'dropped' || status === 'failed') && (op.payload || !txHash)) return 'recovery';
  if (txHash) return 'reconcile';
  if (status === 'broadcast' && !txHash) return 'recovery';
  if (!txHash && !status) return 'first_cert';
  return 'skip_done';
}

export type SendClaimAction = 'exists' | 'in_flight' | 'claim' | 'recover';

export function applySendClaim(input: {
  existingSend: unknown;
  operation: PolygonSendOperation | null;
  nowMs: number;
  claimId: string;
  mailId: string;
  buildPayload: () => { payload: string; payloadHash: string; timestamp: string };
}): {
  action: SendClaimAction;
  txHash: string | null;
  payload: string | null;
  payloadHash: string | null;
  timestamp: string | null;
  retryCount: number;
  operation: PolygonSendOperation | null;
} {
  const existingSend = isPolygonTxHash(input.existingSend) ? input.existingSend : null;
  const op = input.operation || {};
  const opHash = isPolygonTxHash(op.txHash) ? op.txHash : null;
  const txHash = existingSend || opHash;
  const claimFresh =
    typeof op.claimExpiresAt === 'number' &&
    op.claimExpiresAt > input.nowMs &&
    typeof op.claimOwner === 'string' &&
    op.claimOwner.length > 0 &&
    op.claimOwner !== input.claimId;

  if (txHash && (op.status === 'mined' || op.status === 'broadcast' || op.status === 'pending' || !op.status)) {
    return {
      action: 'exists',
      txHash,
      payload: typeof op.payload === 'string' ? op.payload : null,
      payloadHash: typeof op.payloadHash === 'string' ? op.payloadHash : null,
      timestamp: typeof op.timestamp === 'string' ? op.timestamp : null,
      retryCount: Number(op.retryCount) || 0,
      operation: op,
    };
  }

  const frozenPayload = typeof op.payload === 'string' && op.payload ? op.payload : null;
  const frozenHash = typeof op.payloadHash === 'string' ? op.payloadHash : frozenPayload ? hashPolygonPayload(frozenPayload) : null;
  const frozenTs = typeof op.timestamp === 'string' ? op.timestamp : null;
  const recoverable =
    frozenPayload &&
    (op.status === 'reserved' ||
      op.status === 'dropped' ||
      op.status === 'failed' ||
      (op.status === 'broadcast' && !txHash));

  if (recoverable && claimFresh) {
    return {
      action: 'in_flight',
      txHash,
      payload: frozenPayload,
      payloadHash: frozenHash,
      timestamp: frozenTs,
      retryCount: Number(op.retryCount) || 0,
      operation: op,
    };
  }

  if (recoverable) {
    const retryCount = (Number(op.retryCount) || 0) + (op.claimOwner ? 1 : 0);
    const next: PolygonSendOperation = {
      ...op,
      certificationId: op.certificationId || sendCertificationId(input.mailId),
      mailId: input.mailId,
      type: 'send',
      payload: frozenPayload,
      payloadHash: frozenHash || undefined,
      timestamp: frozenTs || undefined,
      status: 'reserved',
      retryCount,
      lastError: null,
      claimOwner: input.claimId,
      claimExpiresAt: input.nowMs + SEND_CLAIM_TTL_MS,
    };
    return {
      action: 'recover',
      txHash,
      payload: frozenPayload,
      payloadHash: frozenHash,
      timestamp: frozenTs,
      retryCount,
      operation: next,
    };
  }

  if (txHash) {
    return {
      action: 'exists',
      txHash,
      payload: frozenPayload,
      payloadHash: frozenHash,
      timestamp: frozenTs,
      retryCount: Number(op.retryCount) || 0,
      operation: op,
    };
  }

  const built = input.buildPayload();
  const next: PolygonSendOperation = {
    certificationId: sendCertificationId(input.mailId),
    mailId: input.mailId,
    type: 'send',
    payload: built.payload,
    payloadHash: built.payloadHash,
    timestamp: built.timestamp,
    nonce: null,
    txHash: null,
    status: 'reserved',
    retryCount: 0,
    lastError: null,
    claimOwner: input.claimId,
    claimExpiresAt: input.nowMs + SEND_CLAIM_TTL_MS,
  };
  return {
    action: 'claim',
    txHash: null,
    payload: built.payload,
    payloadHash: built.payloadHash,
    timestamp: built.timestamp,
    retryCount: 0,
    operation: next,
  };
}

export const HITO_CLAIM_TTL_MS = 60_000;

export function buildHitoOnChainPayload(input: {
  prefix: string;
  messageId: string;
  userId: string;
  contentHash?: string;
  via?: string;
  snapshotHash?: string;
  wamid?: string;
  sendTxHash?: string;
  timestamp: string;
}): string {
  const parts = [input.prefix, input.messageId, input.userId];
  if (input.contentHash) parts.push(input.contentHash);
  if (input.via) parts.push(`via:${input.via}`);
  if (input.snapshotHash) parts.push(`snap:${input.snapshotHash}`);
  if (input.wamid) parts.push(`wamid:${input.wamid}`);
  if (input.sendTxHash) parts.push(`ref:${input.sendTxHash}`);
  parts.push(input.timestamp);
  return parts.join('|');
}

export function extractPolygonTxHashFromError(error: unknown): string | null {
  const msg = error instanceof Error ? error.message : String(error || '');
  const match = msg.match(/0x[0-9a-fA-F]{64}/);
  return match && isPolygonTxHash(match[0]) ? match[0] : null;
}

export function shouldReleaseHitoPending(error: unknown, txHash?: string | null): boolean {
  if (isPolygonTxHash(txHash) || isPolygonTxHash(extractPolygonTxHashFromError(error))) return false;
  const msg = error instanceof Error ? error.message : String(error || '');
  if (msg.startsWith('POLYGON_TX_STILL_PENDING')) return false;
  if (isReplacementUnderpriced(error)) return false;
  return true;
}

export function applyHitoClaim(input: {
  existingTxHash: unknown;
  pending: unknown;
  existingPayload?: unknown;
  claimExpiresAt?: unknown;
  nowMs: number;
}): {
  action: 'exists' | 'pending' | 'claim' | 'recover';
  txHash: string | null;
  payload: string | null;
} {
  const frozen = typeof input.existingPayload === 'string' && input.existingPayload ? input.existingPayload : null;
  if (isPolygonTxHash(input.existingTxHash)) {
    return { action: 'exists', txHash: input.existingTxHash, payload: frozen };
  }
  const expiresAt = typeof input.claimExpiresAt === 'number' ? input.claimExpiresAt : 0;
  const pending = Boolean(input.pending);
  if (pending) {
    const expired = expiresAt > 0 && expiresAt <= input.nowMs;
    if (expired && frozen) {
      return { action: 'recover', txHash: null, payload: frozen };
    }
    if (expired && !frozen) {
      return { action: 'claim', txHash: null, payload: null };
    }
    return { action: 'pending', txHash: null, payload: frozen };
  }
  if (frozen) {
    return { action: 'recover', txHash: null, payload: frozen };
  }
  return { action: 'claim', txHash: null, payload: null };
}

export function blockchainMovementStatusForHash(): 'broadcast' {
  return 'broadcast';
}

export function blockchainMovementStatusForReceipt(): 'mined' {
  return 'mined';
}
