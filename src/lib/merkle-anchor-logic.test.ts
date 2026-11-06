import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hashPolygonPayload } from './polygon-send-logic';
import {
  buildCampaignAnchorPayload,
  canMarkMerkleFailed,
  decideMerkleClose,
  merkleBatchStatusForChain,
  resolveStableAnchorPayload,
  decideEventLeafPlacement,
  DRAIN_CHUNK_SIZE,
  DRAIN_GIVE_UP_DELAY_SEC,
  DRAIN_MAX_ATTEMPTS,
  DRAIN_NEXT_DELAY_SEC,
  DRAIN_RETRY_DELAY_SEC,
  nextDrainSlice,
  planDrainStep,
  shouldStopDrain,
  startDrainRound,
  orderBatchesSendFirst,
  parkedEventLeafId,
} from './merkle-anchor-logic';

const HASH = `0x${'ab'.repeat(32)}`;
const FROZEN_TS = '2026-01-01T00:00:00.000Z';

function frozenPayload() {
  return buildCampaignAnchorPayload({
    kind: 'send',
    campaignId: 'camp_1',
    batchId: 'send-1',
    merkleRoot: 'root',
    leafCount: 2,
    timestamp: FROZEN_TS,
    leavesDigest: 'digest',
  });
}

test('1. un batch genera un solo payload', () => {
  let built = 0;
  const first = resolveStableAnchorPayload({
    build: () => {
      built += 1;
      return { payload: frozenPayload(), timestamp: FROZEN_TS };
    },
  });
  assert.equal(built, 1);
  assert.equal(first.reused, false);
  assert.equal(first.payload, frozenPayload());
  assert.equal(first.payloadHash, hashPolygonPayload(frozenPayload()));
});

test('2. retry del mismo batch reutiliza exactamente el mismo payload', () => {
  const first = resolveStableAnchorPayload({
    build: () => ({ payload: frozenPayload(), timestamp: FROZEN_TS }),
  });
  let built = 0;
  const retry = resolveStableAnchorPayload({
    existingPayload: first.payload,
    existingTimestamp: first.timestamp,
    existingPayloadHash: first.payloadHash,
    build: () => {
      built += 1;
      return { payload: 'CAMPAIGN_SEND|v2|SHOULD-NOT-HAPPEN', timestamp: '2099-01-01T00:00:00.000Z' };
    },
  });
  assert.equal(built, 0);
  assert.equal(retry.reused, true);
  assert.equal(retry.payload, first.payload);
  assert.equal(retry.payloadHash, first.payloadHash);
});

test('3. retry conserva el mismo timestamp', () => {
  const first = resolveStableAnchorPayload({
    build: () => ({ payload: frozenPayload(), timestamp: FROZEN_TS }),
  });
  const retry = resolveStableAnchorPayload({
    existingPayload: first.payload,
    existingTimestamp: first.timestamp,
    existingPayloadHash: first.payloadHash,
    build: () => ({ payload: 'NEW', timestamp: new Date().toISOString() }),
  });
  assert.equal(retry.timestamp, FROZEN_TS);
  assert.equal(retry.payload.includes(FROZEN_TS), true);
  assert.equal(retry.payload.includes('2099'), false);
});

test('4. batch con txHash pending no transmite otra TX', () => {
  assert.equal(
    decideMerkleClose({
      status: 'sealing',
      chainStatus: 'pending',
      txHash: HASH,
      payload: frozenPayload(),
    }),
    'reconcile'
  );
  assert.equal(canMarkMerkleFailed({ txHash: HASH, chainStatus: 'pending' }), false);
  assert.equal(merkleBatchStatusForChain('pending', HASH), 'sealing');
});

test('5. batch mined pasa a anchored', () => {
  assert.equal(merkleBatchStatusForChain('mined', HASH), 'anchored');
  assert.equal(
    decideMerkleClose({
      status: 'sealing',
      chainStatus: 'mined',
      txHash: HASH,
      payload: frozenPayload(),
    }),
    'done'
  );
});

test('6. error antes del broadcast puede reintentarse', () => {
  assert.equal(
    decideMerkleClose({
      status: 'failed',
      payload: frozenPayload(),
      lastError: 'rpc timeout',
    }),
    'retry_same_payload'
  );
  assert.equal(
    decideMerkleClose({
      status: 'sealing',
      chainStatus: 'reserved',
      payload: frozenPayload(),
      lastError: 'provider down',
    }),
    'retry_same_payload'
  );
  assert.equal(canMarkMerkleFailed({ chainStatus: 'failed' }), true);
});

test('7. error después de broadcast no crea otro payload ni otra TX', () => {
  assert.equal(canMarkMerkleFailed({ txHash: HASH, chainStatus: 'broadcast' }), false);
  assert.equal(
    decideMerkleClose({
      status: 'sealing',
      chainStatus: 'broadcast',
      txHash: HASH,
      payload: frozenPayload(),
      lastError: 'Timeout',
    }),
    'reconcile'
  );
  const retry = resolveStableAnchorPayload({
    existingPayload: frozenPayload(),
    existingTimestamp: FROZEN_TS,
    build: () => ({ payload: 'NEW', timestamp: 'new' }),
  });
  assert.equal(retry.payload, frozenPayload());
  assert.equal(
    decideMerkleClose({
      status: 'sealing',
      chainStatus: 'reserved',
      payload: frozenPayload(),
    }),
    'skip_in_flight'
  );
});

test('un hecho solo se sella si su envío ya está anclado; si no, se aparca', () => {
  const leaf = '62eee5dda8699da3deaef281846845a675ca0d654b2327249c94eb8e3c072c29';
  assert.equal(decideEventLeafPlacement({ sendLeafHash: leaf, sendBatchStatus: 'anchored' }), 'seal');
  assert.equal(decideEventLeafPlacement({ sendLeafHash: leaf, sendBatchStatus: 'sealing' }), 'park_send_not_anchored');
  assert.equal(decideEventLeafPlacement({ sendLeafHash: leaf, sendBatchStatus: 'open' }), 'park_send_not_anchored');
  assert.equal(decideEventLeafPlacement({ sendLeafHash: leaf, sendBatchStatus: 'failed' }), 'park_send_not_anchored');
  assert.equal(decideEventLeafPlacement({ sendLeafHash: leaf, sendBatchStatus: null }), 'park_send_not_anchored');
});

test('un hecho sin hoja de envío no se sella con el puntero vacío', () => {
  assert.equal(decideEventLeafPlacement({ sendLeafHash: '', sendBatchStatus: 'anchored' }), 'park_no_send_leaf');
  assert.equal(decideEventLeafPlacement({ sendLeafHash: '   ' }), 'park_no_send_leaf');
  assert.equal(decideEventLeafPlacement({}), 'park_no_send_leaf');
});

test('el aparcado de un hecho es idempotente por mensaje y tipo', () => {
  assert.equal(parkedEventLeafId('m1', 'wa_delivered'), 'm1_wa_delivered');
  assert.notEqual(parkedEventLeafId('m1', 'wa_delivered'), parkedEventLeafId('m1', 'wa_read'));
});

test('al cerrar, las tandas de envío van antes que las de hechos (aunque el id de hechos sea menor)', () => {
  const ordered = orderBatchesSendFirst([
    { id: 'events-2026-11-03', kind: 'event' },
    { id: 'send-1', kind: 'send' },
    { id: 'events-2026-11-03-2', kind: 'event' },
    { id: 'send-0', kind: 'send' },
  ]).map((b) => b.id);
  assert.deepEqual(ordered, ['send-0', 'send-1', 'events-2026-11-03', 'events-2026-11-03-2']);
});

test('el drenaje corta una tanda de 500 mensajes en 10 trozos de 50, el último parcial si hace falta', () => {
  const ids = Array.from({ length: 500 }, (_, i) => `m${String(i).padStart(3, '0')}`);
  assert.equal(DRAIN_CHUNK_SIZE, 50);
  let offset = 0;
  let chunks = 0;
  for (;;) {
    const { slice, nextOffset, done } = nextDrainSlice(ids, offset);
    assert.ok(slice.length <= DRAIN_CHUNK_SIZE);
    assert.equal(slice[0], ids[offset]);
    chunks += 1;
    offset = nextOffset;
    if (done) break;
  }
  assert.equal(chunks, 10);
  assert.equal(offset, 500);
});

test('nextDrainSlice: offset 0, 50, 50, último parcial y vacío', () => {
  const ids = Array.from({ length: 120 }, (_, i) => i);
  const a = nextDrainSlice(ids, 0);
  assert.equal(a.slice.length, 50);
  assert.deepEqual([a.nextOffset, a.done], [50, false]);
  const b = nextDrainSlice(ids, 50);
  assert.equal(b.slice[0], 50);
  assert.deepEqual([b.slice.length, b.nextOffset, b.done], [50, 100, false]);
  const c = nextDrainSlice(ids, 100);
  assert.deepEqual([c.slice.length, c.nextOffset, c.done], [20, 120, true]);
  const empty = nextDrainSlice([], 0);
  assert.deepEqual([empty.slice.length, empty.nextOffset, empty.done], [0, 0, true]);
  const past = nextDrainSlice(ids, 999);
  assert.deepEqual([past.slice.length, past.nextOffset, past.done], [0, 120, true]);
  assert.equal(nextDrainSlice(ids, 0, 120).done, true);
});

test('shouldStopDrain: antes, en y después del deadline', () => {
  assert.equal(shouldStopDrain(999, 1000), false);
  assert.equal(shouldStopDrain(1000, 1000), true);
  assert.equal(shouldStopDrain(1001, 1000), true);
});

test('planDrainStep avanza solo con el trozo completo y reintenta el mismo si no', () => {
  const ok = planDrainStep({ state: { offset: 50, attempts: 3 }, nextOffset: 100, sliceDone: false, chunkComplete: true });
  assert.deepEqual(ok.progress, { offset: 100, done: false, attempts: 0 });
  assert.equal(ok.reschedule, true);
  assert.equal(ok.delaySec, DRAIN_NEXT_DELAY_SEC);

  const last = planDrainStep({ state: { offset: 450 }, nextOffset: 500, sliceDone: true, chunkComplete: true });
  assert.deepEqual(last.progress, { offset: 500, done: true, attempts: 0 });
  assert.equal(last.reschedule, false);

  const blocked = planDrainStep({ state: { offset: 50, attempts: 1 }, nextOffset: 100, sliceDone: false, chunkComplete: false });
  assert.deepEqual(blocked.progress, { offset: 50, done: false, attempts: 2 });
  assert.equal(blocked.reschedule, true);
  assert.equal(blocked.delaySec, DRAIN_RETRY_DELAY_SEC);

  const gaveUp = planDrainStep({
    state: { offset: 50, attempts: DRAIN_MAX_ATTEMPTS - 1 },
    nextOffset: 100,
    sliceDone: false,
    chunkComplete: false,
  });
  assert.equal(gaveUp.gaveUp, true);
  assert.equal(gaveUp.reschedule, false);
  assert.equal(gaveUp.progress.offset, 50);
});

test('startDrainRound: una ronda agotada reanuda con attempts 0 y el mismo offset', () => {
  assert.deepEqual(startDrainRound({ offset: 50, attempts: DRAIN_MAX_ATTEMPTS, done: false }), {
    offset: 50,
    attempts: 0,
    done: false,
  });
  assert.equal(startDrainRound({ offset: 50, attempts: DRAIN_MAX_ATTEMPTS + 1, done: false }).attempts, 0);
  // no resetea una ronda en curso
  const mid = { offset: 50, attempts: 3, done: false };
  assert.deepEqual(startDrainRound(mid), mid);
  // no toca lo que ya terminó
  const finished = { offset: 500, attempts: DRAIN_MAX_ATTEMPTS, done: true };
  assert.deepEqual(startDrainRound(finished), finished);
});

test('tras un gaveUp y startDrainRound, un trozo incompleto cuenta 1 (no 21) y se reanuda en 15 min', () => {
  const stuck = planDrainStep({
    state: { offset: 50, attempts: DRAIN_MAX_ATTEMPTS - 1 },
    nextOffset: 100,
    sliceDone: false,
    chunkComplete: false,
  });
  assert.equal(stuck.gaveUp, true);
  assert.equal(stuck.reschedule, false);
  assert.equal(stuck.progress.attempts, DRAIN_MAX_ATTEMPTS);
  assert.equal(DRAIN_GIVE_UP_DELAY_SEC, 900);

  const next = planDrainStep({
    state: startDrainRound(stuck.progress),
    nextOffset: 100,
    sliceDone: false,
    chunkComplete: false,
  });
  assert.equal(next.progress.attempts, 1);
  assert.equal(next.progress.offset, 50);
  assert.equal(next.gaveUp, false);
  assert.equal(next.reschedule, true);

  const resumed = planDrainStep({
    state: startDrainRound(stuck.progress),
    nextOffset: 100,
    sliceDone: false,
    chunkComplete: true,
  });
  assert.deepEqual(resumed.progress, { offset: 100, done: false, attempts: 0 });
});
