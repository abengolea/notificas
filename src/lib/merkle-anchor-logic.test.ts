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
