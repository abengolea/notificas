import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(process.cwd(), '.env.local'), override: true });
if (!process.env.POLYGON_PROVIDER_URL?.includes('drpc') && !process.env.POLYGON_PROVIDER_URL?.includes('1rpc')) {
  process.env.POLYGON_PROVIDER_URL = 'https://polygon.drpc.org';
}

const RUN = process.env.POLYGON_PROBE_RESUME || 'probe-1791402905409';
const mailC = `${RUN}-c`;
const campaignId = RUN;
const batchId = 'send-0';
const recipient = 'polygon-probe@notificas.local';

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const { getAdminDb } = await import('../src/lib/firebase-admin.ts');
  const cert = await import('../src/lib/certification-polygon.ts');
  const integrity = await import('../src/lib/campaign-integrity.ts');
  const chain = await import('../src/lib/blockchain.ts');
  const db = getAdminDb();

  const wallet = (await db.doc('system/polygon_wallet').get()).data() || {};
  console.log(JSON.stringify({ event: 'wallet_before', lastBroadcastNonce: wallet.lastBroadcastNonce, lastBroadcastTxHash: wallet.lastBroadcastTxHash, reservedNonce: wallet.reservedNonce, lastStatus: wallet.lastStatus }));

  const hashC = await cert.certificarEnvio(mailC, 'polygon-circuit-probe', recipient, 'probe-c');
  const mailCSnap = await db.collection('mail').doc(mailC).get();
  const opC = (mailCSnap.data()?.polygonCertifications?.sendOperation || {}) as Record<string, unknown>;
  console.log(JSON.stringify({ event: 'mail_c', hash: hashC, status: opC.status, nonce: opC.nonce, payload: opC.payload, payloadHash: opC.payloadHash, timestamp: opC.timestamp }));

  const merkle1 = await integrity.closeIntegrityBatch(campaignId, batchId, { force: true });
  const batch1 = (await db.collection('campaigns').doc(campaignId).collection('integrity_batches').doc(batchId).get()).data() || {};
  const chain1 = (batch1.chain || {}) as Record<string, unknown>;
  console.log(JSON.stringify({ event: 'merkle_close_1', result: merkle1, status: batch1.status, chainStatus: chain1.status, txHash: chain1.txHash || batch1.txHash, timestamp: chain1.timestamp, payloadHash: chain1.payloadHash, payload: chain1.payload || batch1.payload }));

  const merkle2 = await integrity.closeIntegrityBatch(campaignId, batchId, { force: true });
  const batch2 = (await db.collection('campaigns').doc(campaignId).collection('integrity_batches').doc(batchId).get()).data() || {};
  const chain2 = (batch2.chain || {}) as Record<string, unknown>;
  console.log(JSON.stringify({
    event: 'merkle_close_2',
    result: merkle2,
    status: batch2.status,
    chainStatus: chain2.status,
    txHash: chain2.txHash || batch2.txHash,
    samePayload: (chain1.payload || batch1.payload) === (chain2.payload || batch2.payload),
    sameTimestamp: chain1.timestamp === chain2.timestamp,
    sameTxHash: (chain1.txHash || batch1.txHash) === (chain2.txHash || batch2.txHash),
  }));

  const hashes = [hashC, String(chain2.txHash || batch2.txHash || '')].filter((h) => h.startsWith('0x'));
  for (const h of hashes) {
    for (let i = 0; i < 30; i++) {
      const st = await chain.inspectPolygonTx(h);
      if (st === 'mined') {
        console.log(JSON.stringify({ event: 'mined', hash: h, explorer: `https://polygonscan.com/tx/${h}` }));
        break;
      }
      await sleep(4000);
    }
  }

  const batch3 = (await db.collection('campaigns').doc(campaignId).collection('integrity_batches').doc(batchId).get()).data() || {};
  const chain3 = (batch3.chain || {}) as Record<string, unknown>;
  const opC2 = ((await db.collection('mail').doc(mailC).get()).data()?.polygonCertifications?.sendOperation || {}) as Record<string, unknown>;
  const walletAfter = (await db.doc('system/polygon_wallet').get()).data() || {};
  console.log(JSON.stringify({
    event: 'final',
    mailC: { hash: hashC, status: opC2.status, nonce: opC2.nonce },
    merkle: { status: batch3.status, chainStatus: chain3.status, txHash: chain3.txHash || batch3.txHash, timestamp: chain3.timestamp },
    wallet: { lastBroadcastNonce: walletAfter.lastBroadcastNonce, lastBroadcastTxHash: walletAfter.lastBroadcastTxHash, reservedNonce: walletAfter.reservedNonce },
  }));
}

main().catch((e) => {
  console.error(JSON.stringify({ event: 'fatal', error: e instanceof Error ? e.message : String(e) }));
  process.exit(1);
});
