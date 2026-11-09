import { test } from 'node:test';
import assert from 'node:assert/strict';
import { collectChainTransactions } from './certificate-chain-evidence';

const TX_SEND = '0x' + 'a1'.repeat(32);
const TX_READ = '0x' + 'b2'.repeat(32);
const TX_BAD = '0x' + 'c3'.repeat(32);

test('collectChainTransactions trae bloque, fecha, emisor y payload de cada TX, en el orden del certificado', async () => {
  const seen: string[] = [];
  const out = await collectChainTransactions(
    { waRead: TX_READ, send: TX_SEND, updatedAt: new Date(), contentHash: 'x'.repeat(64), waBodyHash: 'no es una TX' },
    {
      fetchInfo: async (tx) => {
        seen.push(tx);
        return { from: '0x1Cc132e0BeAD9A53aeB7885259DF9FEFb3ede66A', blockNumber: 96693320, timestamp: 1793745436, data: `SEND|${tx}` };
      },
    }
  );
  assert.deepEqual(out.map((e) => e.key), ['send', 'waRead']);
  assert.equal(out[0].txHash, TX_SEND);
  assert.equal(out[0].blockNumber, 96693320);
  assert.equal(out[0].blockTime, new Date(1793745436 * 1000).toISOString());
  assert.equal(out[0].from, '0x1Cc132e0BeAD9A53aeB7885259DF9FEFb3ede66A');
  assert.equal(out[0].payload, `SEND|${TX_SEND}`);
  assert.equal(seen.length, 2);
});

test('si la red falla, se pasa de largo o la TX no está minada, la entrada queda sin datos y no se inventan', async () => {
  const out = await collectChainTransactions(
    { send: TX_SEND, waDelivered: TX_READ, waRead: TX_BAD },
    {
      timeoutMs: 20,
      fetchInfo: async (tx) => {
        if (tx === TX_SEND) throw new Error('rpc caído');
        if (tx === TX_READ) return { from: '0xabc', blockNumber: undefined, timestamp: undefined, data: 'WA_DELIVERED|x' };
        return new Promise(() => undefined); // nunca responde
      },
    }
  );
  assert.equal(out.length, 3);
  assert.deepEqual(out[0], { key: 'send', txHash: TX_SEND, blockNumber: null, blockTime: null, from: null, payload: null });
  assert.equal(out[1].blockNumber, null);
  assert.equal(out[1].blockTime, null);
  assert.equal(out[1].payload, 'WA_DELIVERED|x');
  assert.deepEqual(out[2], { key: 'waRead', txHash: TX_BAD, blockNumber: null, blockTime: null, from: null, payload: null });
});

test('sin certificaciones no consulta nada', async () => {
  let calls = 0;
  const fetchInfo = async () => {
    calls += 1;
    return {};
  };
  assert.deepEqual(await collectChainTransactions(undefined, { fetchInfo }), []);
  assert.deepEqual(await collectChainTransactions({}, { fetchInfo }), []);
  assert.equal(calls, 0);
});
