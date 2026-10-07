import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applySendClaim,
  canReleaseWalletLock,
  applyHitoClaim,
  blockchainMovementStatusForHash,
  blockchainMovementStatusForReceipt,
  classifyRetryCertifyAction,
  hashPolygonPayload,
  HITO_CLAIM_TTL_MS,
  isPolygonTxHash,
  isAlreadyKnownTxError,
  isReplacementUnderpriced,
  isTransientPolygonRpcError,
  isWalletLockBusy,
  resolveNextNonce,
  resolvePolygonRpcUrls,
  sendCertificationId,
  SEND_CLAIM_TTL_MS,
  shouldReleaseHitoPending,
} from './polygon-send-logic';

const HASH = `0x${'ab'.repeat(32)}`;
const HASH_B = `0x${'cd'.repeat(32)}`;

test('send certificationId is stable per mailId', () => {
  assert.equal(sendCertificationId('mail_1'), 'send:mail_1');
});

test('isPolygonTxHash', () => {
  assert.equal(isPolygonTxHash(HASH), true);
  assert.equal(isPolygonTxHash('0x123'), false);
  assert.equal(isPolygonTxHash(undefined), false);
});

test('legacy polygonCertifications.send never claims a new TX', () => {
  let built = 0;
  const decided = applySendClaim({
    existingSend: HASH,
    operation: null,
    nowMs: 1_000,
    claimId: 'a',
    mailId: 'mail_1',
    buildPayload: () => {
      built += 1;
      throw new Error('no new payload');
    },
  });
  assert.equal(decided.action, 'exists');
  assert.equal(decided.txHash, HASH);
  assert.equal(built, 0);
});

test('two concurrent claims produce a single payload and one TX right', () => {
  let built = 0;
  const first = applySendClaim({
    existingSend: null,
    operation: null,
    nowMs: 1_000,
    claimId: 'owner-a',
    mailId: 'mail_1',
    buildPayload: () => {
      built += 1;
      return {
        payload: 'SEND|mail_1|u|a@b.c|2026-01-01T00:00:00.000Z',
        payloadHash: hashPolygonPayload('SEND|mail_1|u|a@b.c|2026-01-01T00:00:00.000Z'),
        timestamp: '2026-01-01T00:00:00.000Z',
      };
    },
  });
  assert.equal(first.action, 'claim');
  assert.equal(built, 1);
  assert.equal(first.operation?.status, 'reserved');
  assert.equal(first.payload?.includes('2026-01-01T00:00:00.000Z'), true);

  const second = applySendClaim({
    existingSend: null,
    operation: first.operation,
    nowMs: 1_500,
    claimId: 'owner-b',
    mailId: 'mail_1',
    buildPayload: () => {
      built += 1;
      return {
        payload: 'SEND|mail_1|u|a@b.c|SHOULD-NOT-HAPPEN',
        payloadHash: 'nope',
        timestamp: 'SHOULD-NOT-HAPPEN',
      };
    },
  });
  assert.equal(second.action, 'in_flight');
  assert.equal(second.payload, first.payload);
  assert.equal(built, 1);
});

test('expired reserved reuses the same payload on recover', () => {
  const claimed = applySendClaim({
    existingSend: null,
    operation: null,
    nowMs: 1_000,
    claimId: 'owner-a',
    mailId: 'mail_1',
    buildPayload: () => ({
      payload: 'SEND|mail_1|frozen',
      payloadHash: hashPolygonPayload('SEND|mail_1|frozen'),
      timestamp: '2026-01-01T00:00:00.000Z',
    }),
  });
  const recovered = applySendClaim({
    existingSend: null,
    operation: claimed.operation,
    nowMs: 1_000 + SEND_CLAIM_TTL_MS + 1,
    claimId: 'owner-b',
    mailId: 'mail_1',
    buildPayload: () => ({
      payload: 'NEW',
      payloadHash: 'x',
      timestamp: 'new',
    }),
  });
  assert.equal(recovered.action, 'recover');
  assert.equal(recovered.payload, 'SEND|mail_1|frozen');
  assert.equal(recovered.payloadHash, claimed.payloadHash);
});

test('broadcast/pending/mined with txHash do not create another certification', () => {
  for (const status of ['broadcast', 'pending', 'mined'] as const) {
    const decided = applySendClaim({
      existingSend: HASH,
      operation: { status, txHash: HASH, payload: 'SEND|mail_1|frozen' },
      nowMs: 1,
      claimId: 'x',
      mailId: 'mail_1',
      buildPayload: () => ({ payload: 'no', payloadHash: 'no', timestamp: 'no' }),
    });
    assert.equal(decided.action, 'exists');
    assert.equal(decided.txHash, HASH);
  }
});

test('distinct certifications get distinct nonces; reserved nonce is reused', () => {
  const first = resolveNextNonce({
    latest: 100,
    pending: 100,
    lastBroadcastNonce: null,
    reservedNonce: null,
    reservedHasTxHash: false,
  });
  assert.equal(first.nonce, 100);
  const second = resolveNextNonce({
    latest: 100,
    pending: 101,
    lastBroadcastNonce: 100,
    reservedNonce: null,
    reservedHasTxHash: false,
  });
  assert.equal(second.nonce, 101);
  assert.notEqual(first.nonce, second.nonce);

  const reuse = resolveNextNonce({
    latest: 100,
    pending: 100,
    lastBroadcastNonce: null,
    reservedNonce: 101,
    reservedHasTxHash: false,
  });
  assert.equal(reuse.nonce, 101);
  assert.equal(reuse.reuseReserved, true);
});

test('wallet lock release is owner-safe', () => {
  assert.equal(canReleaseWalletLock('lock-a', 'lock-a'), true);
  assert.equal(canReleaseWalletLock('lock-b', 'lock-a'), false);
  assert.equal(canReleaseWalletLock(null, 'lock-a'), false);
  assert.equal(
    isWalletLockBusy({ lockOwner: 'a', expiresAt: 2_000, nowMs: 1_000, myLockId: 'b' }),
    true
  );
  assert.equal(
    isWalletLockBusy({ lockOwner: 'a', expiresAt: 500, nowMs: 1_000, myLockId: 'b' }),
    false
  );
});

test('RPC list keeps env first, skips dead hosts, and de-duplicates fallbacks', () => {
  const fromEnv = resolvePolygonRpcUrls('https://polygon-bor-rpc.publicnode.com');
  assert.equal(fromEnv[0], 'https://polygon-bor-rpc.publicnode.com');
  assert.equal(fromEnv.includes('https://polygon.drpc.org'), true);
  assert.equal(fromEnv.includes('https://1rpc.io/matic'), true);
  assert.equal(new Set(fromEnv).size, fromEnv.length);

  const skippedDead = resolvePolygonRpcUrls('https://polygon-rpc.com');
  assert.equal(skippedDead.includes('https://polygon-rpc.com'), false);
  assert.equal(skippedDead[0], 'https://polygon.drpc.org');
});

test('transient RPC vs already-known vs insufficient funds', () => {
  assert.equal(isTransientPolygonRpcError({ message: 'could not reach node' }), true);
  assert.equal(isTransientPolygonRpcError({ info: { responseStatus: '503 Service Unavailable' } }), true);
  assert.equal(isTransientPolygonRpcError({ code: 'SERVER_ERROR', message: '500 Internal Server Error' }), true);
  assert.equal(isTransientPolygonRpcError({ code: 'INSUFFICIENT_FUNDS' }), false);
  assert.equal(isAlreadyKnownTxError({ message: 'already known' }), true);
  assert.equal(isAlreadyKnownTxError({ message: 'nonce too low' }), false);
});

test('REPLACEMENT_UNDERPRICED detection', () => {
  assert.equal(isReplacementUnderpriced({ code: 'REPLACEMENT_UNDERPRICED' }), true);
  assert.equal(isReplacementUnderpriced({ message: 'replacement transaction underpriced' }), true);
  assert.equal(isReplacementUnderpriced({ message: 'replacement fee too low' }), true);
  assert.equal(isReplacementUnderpriced({ message: 'INSUFFICIENT_FUNDS' }), false);
});

test('8. dos eventos iguales concurrentes generan una única certificación lógica', () => {
  const first = applyHitoClaim({
    existingTxHash: null,
    pending: false,
    nowMs: 1_000,
  });
  assert.equal(first.action, 'claim');
  const second = applyHitoClaim({
    existingTxHash: null,
    pending: true,
    existingPayload: 'CONTENT_ACCESS|mail_1|u|2026-01-01T00:00:00.000Z',
    claimExpiresAt: 1_000 + HITO_CLAIM_TTL_MS,
    nowMs: 1_500,
  });
  assert.equal(second.action, 'pending');
  assert.equal(second.txHash, null);
});

test('9. una operación broadcast no libera el claim por timeout', () => {
  assert.equal(
    shouldReleaseHitoPending(new Error('Timeout certificación Polygon CONTENT_ACCESS (>40s)'), HASH),
    false
  );
  assert.equal(
    shouldReleaseHitoPending(new Error(`POLYGON_TX_STILL_PENDING:${HASH}`), null),
    false
  );
  assert.equal(shouldReleaseHitoPending(new Error('provider down'), null), true);
});

test('10. un txHash existente impide otro broadcast', () => {
  const decided = applyHitoClaim({
    existingTxHash: HASH,
    pending: true,
    existingPayload: 'CONTENT_ACCESS|mail_1|frozen',
    nowMs: 1,
  });
  assert.equal(decided.action, 'exists');
  assert.equal(decided.txHash, HASH);
});

test('11. hash obtenido → broadcast, no confirmed', () => {
  assert.equal(blockchainMovementStatusForHash(), 'broadcast');
  assert.notEqual(blockchainMovementStatusForHash(), 'confirmed');
});

test('12. receipt → mined', () => {
  assert.equal(blockchainMovementStatusForReceipt(), 'mined');
});

test('cron never reemits mined or pending; recovers reserved without hash', () => {
  assert.equal(classifyRetryCertifyAction({ send: HASH, sendOperation: { status: 'mined', txHash: HASH } }), 'skip_done');
  assert.equal(classifyRetryCertifyAction({ send: HASH, sendOperation: { status: 'pending', txHash: HASH } }), 'skip_wait');
  assert.equal(classifyRetryCertifyAction({ sendOperation: { status: 'reserved', payload: 'SEND|x' } }), 'recovery');
  assert.equal(classifyRetryCertifyAction({ send: HASH, sendOperation: { status: 'broadcast', txHash: HASH } }), 'reconcile');
  assert.equal(classifyRetryCertifyAction({}), 'first_cert');
  assert.equal(classifyRetryCertifyAction({ send: HASH_B }), 'reconcile');
});
