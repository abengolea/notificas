import { hashPolygonPayload, isPolygonTxHash } from './polygon-send-logic';

export type MerkleChainStatus =
  | 'reserved'
  | 'broadcast'
  | 'pending'
  | 'mined'
  | 'failed'
  | 'dropped'
  | 'replaced';

export type MerkleChainState = {
  merkleRoot?: string;
  payload?: string;
  payloadHash?: string;
  timestamp?: string;
  nonce?: number | null;
  txHash?: string | null;
  status?: MerkleChainStatus | string;
  broadcastAt?: unknown;
  confirmedAt?: unknown;
  retryCount?: number;
  lastError?: string | null;
};

export type MerkleCloseDecision =
  | 'done'
  | 'empty'
  | 'skip_in_flight'
  | 'reconcile'
  | 'retry_same_payload'
  | 'claim'
  | 'retry_fresh'
  | 'not_ready';

export function merkleBatchCertificationId(campaignId: string, batchId: string): string {
  return `batch:${campaignId}:${batchId}`;
}

export function buildCampaignAnchorPayload(input: {
  kind: 'send' | 'event';
  campaignId: string;
  batchId: string;
  merkleRoot: string;
  leafCount: number;
  timestamp: string;
  leavesDigest: string;
  templateSealHash?: string;
  version?: string;
}): string {
  const prefix = input.kind === 'send' ? 'CAMPAIGN_SEND' : 'CAMPAIGN_EVENT';
  const parts = [
    prefix,
    input.version || 'v2',
    input.campaignId,
    input.batchId,
    input.merkleRoot,
    String(input.leafCount),
    input.timestamp,
    input.leavesDigest,
  ];
  if (input.templateSealHash) parts.push(input.templateSealHash);
  return parts.join('|');
}

export function resolveStableAnchorPayload(input: {
  existingPayload?: string | null;
  existingTimestamp?: string | null;
  existingPayloadHash?: string | null;
  build: () => { payload: string; timestamp: string };
}): { payload: string; timestamp: string; payloadHash: string; reused: boolean } {
  const existing = typeof input.existingPayload === 'string' ? input.existingPayload.trim() : '';
  if (existing) {
    const timestamp =
      typeof input.existingTimestamp === 'string' && input.existingTimestamp
        ? input.existingTimestamp
        : extractAnchorTimestamp(existing);
    const payloadHash =
      typeof input.existingPayloadHash === 'string' && input.existingPayloadHash
        ? input.existingPayloadHash
        : hashPolygonPayload(existing);
    return { payload: existing, timestamp, payloadHash, reused: true };
  }
  const built = input.build();
  return {
    payload: built.payload,
    timestamp: built.timestamp,
    payloadHash: hashPolygonPayload(built.payload),
    reused: false,
  };
}

export function extractAnchorTimestamp(payload: string): string {
  const parts = payload.split('|');
  return parts[6] || '';
}

export function decideMerkleClose(input: {
  status: string;
  chainStatus?: string | null;
  txHash?: string | null;
  payload?: string | null;
  lastError?: string | null;
}): MerkleCloseDecision {
  const status = input.status;
  const txHash = isPolygonTxHash(input.txHash) ? input.txHash : null;
  const payload = typeof input.payload === 'string' && input.payload ? input.payload : null;
  const chainStatus = typeof input.chainStatus === 'string' ? input.chainStatus : '';
  const lastError = typeof input.lastError === 'string' && input.lastError ? input.lastError : null;

  if (status === 'anchored' || chainStatus === 'mined') return 'done';
  if (status === 'empty') return 'empty';
  if (txHash) return 'reconcile';
  if (
    payload &&
    status === 'sealing' &&
    !lastError &&
    (chainStatus === 'reserved' || chainStatus === 'broadcast' || chainStatus === 'pending')
  ) {
    return 'skip_in_flight';
  }
  if (payload && (status === 'sealing' || status === 'failed' || chainStatus === 'reserved' || chainStatus === 'dropped' || chainStatus === 'failed')) {
    return 'retry_same_payload';
  }
  if (status === 'sealing' && !payload && !txHash) return 'skip_in_flight';
  if (status === 'failed' && !payload) return 'retry_fresh';
  if (status === 'open') return 'claim';
  return 'not_ready';
}

export function canMarkMerkleFailed(input: { txHash?: string | null; chainStatus?: string | null }): boolean {
  if (isPolygonTxHash(input.txHash)) return false;
  const status = typeof input.chainStatus === 'string' ? input.chainStatus : '';
  return status !== 'reserved' && status !== 'broadcast' && status !== 'pending' && status !== 'mined';
}

export function merkleBatchStatusForChain(chainStatus: string, txHash?: string | null): 'sealing' | 'anchored' | 'failed' {
  if (chainStatus === 'mined' && isPolygonTxHash(txHash)) return 'anchored';
  if (chainStatus === 'failed' && canMarkMerkleFailed({ txHash, chainStatus })) return 'failed';
  return 'sealing';
}

export function readMerkleChain(data: Record<string, unknown> | null | undefined): MerkleChainState {
  const raw = data?.chain && typeof data.chain === 'object' && !Array.isArray(data.chain)
    ? (data.chain as MerkleChainState)
    : {};
  const payload = typeof raw.payload === 'string' ? raw.payload : typeof data?.payload === 'string' ? data.payload : undefined;
  const txHash = isPolygonTxHash(raw.txHash) ? raw.txHash : isPolygonTxHash(data?.txHash) ? data.txHash : null;
  return {
    ...raw,
    payload,
    txHash,
    merkleRoot: typeof raw.merkleRoot === 'string' ? raw.merkleRoot : typeof data?.merkleRoot === 'string' ? data.merkleRoot : raw.merkleRoot,
  };
}

export type EventLeafPlacement = 'seal' | 'park_no_send_leaf' | 'park_send_not_anchored';

/**
 * Una hoja de hecho solo entra a un árbol de eventos si la hoja de envío que cita ya existe y su tanda
 * está minada en Polygon. Si no, se aparca: el hecho no se pierde y el árbol de eventos nunca apunta a un
 * `sendLeafHash` que la cadena todavía no publicó.
 */
export function decideEventLeafPlacement(input: {
  sendLeafHash?: string | null;
  sendBatchStatus?: string | null;
}): EventLeafPlacement {
  if (!String(input.sendLeafHash || '').trim()) return 'park_no_send_leaf';
  return input.sendBatchStatus === 'anchored' ? 'seal' : 'park_send_not_anchored';
}

export function parkedEventLeafId(messageId: string, eventType: string): string {
  return `${messageId}_${eventType}`;
}

/** Tandas de envío primero: sus TX deben salir antes que las de hechos que las citan. */
export function orderBatchesSendFirst<T extends { id: string; kind?: string }>(batches: T[]): T[] {
  const rank = (b: T) => (b.kind === 'send' ? 0 : 1);
  return [...batches].sort((a, b) => rank(a) - rank(b) || a.id.localeCompare(b.id));
}
