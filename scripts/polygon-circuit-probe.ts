/**
 * Batería controlada en Polygon Mainnet (código local + Firestore/wallet reales).
 * No envía correos. Crea docs de probe y 4–5 TX de certificación.
 *
 *   npx tsx --tsconfig tsconfig.json scripts/polygon-circuit-probe.ts
 */
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(process.cwd(), '.env.local'), override: true });

type StepResult = Record<string, unknown>;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function scanUrl(hash: string): string {
  return `https://polygonscan.com/tx/${hash}`;
}

async function main() {
  const [{ ethers }, { getAdminDb }, cert, integrity, chain] = await Promise.all([
    import('ethers'),
    import('../src/lib/firebase-admin.ts'),
    import('../src/lib/certification-polygon.ts'),
    import('../src/lib/campaign-integrity.ts'),
    import('../src/lib/blockchain.ts'),
  ]);

  const rpc = process.env.POLYGON_PROVIDER_URL || 'https://polygon-bor-rpc.publicnode.com';
  const inspectRpcs = [
    rpc,
    'https://polygon.drpc.org',
    'https://1rpc.io/matic',
  ].filter((u, i, all) => all.indexOf(u) === i);
  const rawKey = (process.env.POLYGON_PRIVATE_KEY || '').trim();
  if (!rawKey) throw new Error('Falta POLYGON_PRIVATE_KEY');
  const pk = rawKey.startsWith('0x') ? rawKey : `0x${rawKey}`;
  const provider = new ethers.JsonRpcProvider(inspectRpcs[1] || rpc);
  const wallet = new ethers.Wallet(pk, provider);
  const db = getAdminDb();

  const [network, balance, latest, pending] = await Promise.all([
    provider.getNetwork(),
    provider.getBalance(wallet.address),
    provider.getTransactionCount(wallet.address, 'latest'),
    provider.getTransactionCount(wallet.address, 'pending'),
  ]);
  const pol = Number(ethers.formatEther(balance));
  if (Number(network.chainId) !== 137) {
    throw new Error(`Chain ID inesperado: ${network.chainId}`);
  }
  if (pol < 0.05) {
    throw new Error(`POL insuficiente (${pol}). Aborto para no dejar TX a medias.`);
  }

  const runId = process.env.POLYGON_PROBE_RESUME?.trim() || `probe-${Date.now()}`;
  const resume = Boolean(process.env.POLYGON_PROBE_RESUME?.trim());
  const report: Record<string, unknown> = {
    runId,
    chainId: Number(network.chainId),
    wallet: wallet.address,
    pol,
    nonceBefore: { latest, pending },
    resume,
    steps: {} as Record<string, StepResult>,
  };
  const steps = report.steps as Record<string, StepResult>;

  const mailA = `${runId}-a`;
  const mailB = `${runId}-b`;
  const mailC = `${runId}-c`;
  const campaignId = runId;
  const batchId = 'send-0';
  const campMsgId = `${runId}-leaf`;
  const recipient = 'polygon-probe@notificas.local';

  const writeMail = async (id: string, label: string) => {
    const ref = db.collection('mail').doc(id);
    if ((await ref.get()).exists) return;
    await ref.set({
      createdBy: 'polygon-circuit-probe',
      from: 'polygon-circuit-probe',
      recipientEmail: recipient,
      to: [recipient],
      subject: `polygon-circuit-probe ${label} (no enviar)`,
      message: { contentText: `probe ${runId} ${label}` },
      polygonProbe: true,
      polygonProbeRun: runId,
      createdAt: new Date(),
    });
  };

  await Promise.all([writeMail(mailA, 'A'), writeMail(mailB, 'B'), writeMail(mailC, 'C')]);
  const campRef = db.collection('campaigns').doc(campaignId);
  if (!(await campRef.get()).exists) {
    await campRef.set({
      orgId: 'polygon-probe',
      nombre: 'polygon-circuit-probe',
      status: 'draft',
      canal: 'email',
      polygonProbe: true,
      polygonProbeRun: runId,
      createdAt: new Date(),
    });
  }
  const campMsgRef = db.collection('campaign_messages').doc(campMsgId);
  if (!(await campMsgRef.get()).exists) {
    await campMsgRef.set({
      campaignId,
      orgId: 'polygon-probe',
      mailId: campMsgId,
      recipientEmail: recipient,
      polygonProbe: true,
      polygonProbeRun: runId,
    });
  }
  await integrity.recordSendLeaf({
    campaignId,
    orgId: 'polygon-probe',
    messageId: campMsgId,
    batchId,
    email: recipient,
    phone: '',
    contentHash: 'probe',
    attachmentHashes: [],
  });

  const readSend = async (mailId: string) => {
    const snap = await db.collection('mail').doc(mailId).get();
    const poly = (snap.data()?.polygonCertifications || {}) as Record<string, unknown>;
    const op = (poly.sendOperation || {}) as Record<string, unknown>;
    return {
      send: poly.send || null,
      status: op.status || null,
      nonce: op.nonce ?? null,
      txHash: op.txHash || null,
      payload: op.payload || null,
      timestamp: op.timestamp || null,
      payloadHash: op.payloadHash || null,
    };
  };

  const readMovement = async (txHash: string) => {
    const snap = await db.collection('blockchain_movements').doc(txHash).get();
    const d = snap.data() || {};
    return { exists: snap.exists, status: d.status || null, type: d.type || null };
  };

  const readBatch = async () => {
    const snap = await db.collection('campaigns').doc(campaignId).collection('integrity_batches').doc(batchId).get();
    const d = snap.data() || {};
    const chainState = (d.chain || {}) as Record<string, unknown>;
    return {
      status: d.status || null,
      txHash: d.txHash || chainState.txHash || null,
      payload: d.payload || chainState.payload || null,
      timestamp: chainState.timestamp || null,
      payloadHash: chainState.payloadHash || null,
      chainStatus: chainState.status || null,
    };
  };

  const chainTx = async (hash: string) => {
    let lastErr = 'unknown';
    for (const url of inspectRpcs) {
      try {
        const p = new ethers.JsonRpcProvider(url);
        const tx = await p.getTransaction(hash);
        return {
          found: Boolean(tx),
          nonce: tx?.nonce ?? null,
          from: tx?.from || null,
          explorer: scanUrl(hash),
          rpc: url,
        };
      } catch (e) {
        lastErr = e instanceof Error ? e.message : String(e);
      }
    }
    return { found: false, nonce: null, from: null, explorer: scanUrl(hash), error: lastErr };
  };

  const waitMined = async (hash: string, label: string) => {
    const started = Date.now();
    for (let i = 0; i < 45; i++) {
      const status = await chain.inspectPolygonTx(hash);
      if (status === 'mined') {
        return { status, waitedMs: Date.now() - started, label };
      }
      await sleep(4000);
    }
    return { status: await chain.inspectPolygonTx(hash), waitedMs: Date.now() - started, label };
  };

  console.log(JSON.stringify({ msg: 'polygon_probe', event: 'start', runId, wallet: wallet.address, latest, pending, pol }, null, 2));

  // 1. Mail A sequential SEND
  const existingA = await readSend(mailA);
  const hashA = typeof existingA.send === 'string' && existingA.send.startsWith('0x')
    ? existingA.send
    : await cert.certificarEnvio(mailA, 'polygon-circuit-probe', recipient, 'probe-a');
  const sendA = await readSend(mailA);
  const movA = await readMovement(hashA);
  const txA = await chainTx(hashA);
  steps['1_mail_a_send'] = { hash: hashA, firestore: sendA, movement: movA, chain: txA, explorer: scanUrl(hashA) };
  console.log(JSON.stringify({ msg: 'polygon_probe', event: 'step1', ...steps['1_mail_a_send'] }, null, 2));

  // 2+3. Two SENDs + hito + Merkle almost together
  const wave2 = await Promise.allSettled([
    cert.certificarEnvio(mailB, 'polygon-circuit-probe', recipient, 'probe-b'),
    cert.certificarEnvio(mailC, 'polygon-circuit-probe', recipient, 'probe-c'),
    cert.certifyMailHitoIfNeeded({ docId: mailA, hito: 'content_access', via: 'reader' }),
    integrity.closeIntegrityBatch(campaignId, batchId, { force: true }),
  ]);
  const settled = wave2.map((r) =>
    r.status === 'fulfilled' ? { ok: true, value: r.value } : { ok: false, error: r.reason instanceof Error ? r.reason.message : String(r.reason) }
  );
  const sendB = await readSend(mailB);
  const sendC = await readSend(mailC);
  const mailAAfterHito = (await db.collection('mail').doc(mailA).get()).data()?.polygonCertifications as Record<string, unknown> | undefined;
  const merkle1 = await readBatch();
  steps['2_3_concurrent'] = {
    results: settled,
    mailB: sendB,
    mailC: sendC,
    hito: { contentAccess: mailAAfterHito?.contentAccess || null },
    merkle: merkle1,
  };
  console.log(JSON.stringify({ msg: 'polygon_probe', event: 'step2_3', ...steps['2_3_concurrent'] }, null, 2));

  // 4. Second certificarEnvio(mailA) must return the same hash
  const hashA2 = await cert.certificarEnvio(mailA, 'polygon-circuit-probe', recipient, 'probe-a');
  steps['4_idempotent_send'] = {
    first: hashA,
    second: hashA2,
    same: hashA === hashA2,
  };
  console.log(JSON.stringify({ msg: 'polygon_probe', event: 'step4', ...steps['4_idempotent_send'] }, null, 2));

  // 5. Re-close Merkle while pending/broadcast — same payload/txHash
  const merkleBefore = await readBatch();
  const merkleClose2 = await integrity.closeIntegrityBatch(campaignId, batchId, { force: true });
  const merkleAfter = await readBatch();
  steps['5_merkle_reclose'] = {
    before: merkleBefore,
    closeResult: merkleClose2,
    after: merkleAfter,
    samePayload: merkleBefore.payload === merkleAfter.payload,
    sameTimestamp: merkleBefore.timestamp === merkleAfter.timestamp,
    samePayloadHash: merkleBefore.payloadHash === merkleAfter.payloadHash,
    sameTxHash: merkleBefore.txHash === merkleAfter.txHash,
  };
  console.log(JSON.stringify({ msg: 'polygon_probe', event: 'step5', ...steps['5_merkle_reclose'] }, null, 2));

  const hashes = [hashA, sendB.txHash, sendC.txHash, mailAAfterHito?.contentAccess, merkleAfter.txHash].filter(
    (h): h is string => typeof h === 'string' && h.startsWith('0x')
  );
  const uniqueHashes = [...new Set(hashes)];
  const mined = await Promise.all(uniqueHashes.map((h) => waitMined(h, h.slice(0, 10))));
  const sendAFinal = await readSend(mailA);
  const movAFinal = await readMovement(hashA);
  const merkleFinal = await readBatch();
  const [latestAfter, pendingAfter] = await Promise.all([
    provider.getTransactionCount(wallet.address, 'latest'),
    provider.getTransactionCount(wallet.address, 'pending'),
  ]);

  const onChain = await Promise.all(
    uniqueHashes.map(async (h) => {
      const info = await chainTx(h);
      return { hash: h, ...info };
    })
  );
  const nonces = onChain.map((t) => t.nonce).filter((n): n is number => typeof n === 'number');
  const nonceSet = new Set(nonces);

  steps['6_mined'] = {
    sendA: sendAFinal,
    movementA: movAFinal,
    merkle: merkleFinal,
    inspect: mined,
    onChain,
  };
  report.nonceAfter = { latest: latestAfter, pending: pendingAfter };
  report.nonceCheck = {
    nonces,
    unique: nonceSet.size === nonces.length,
    consecutiveFrom: latest,
    expectedCount: uniqueHashes.length,
  };
  report.verdict = {
    singleSendA: Boolean(hashA) && hashA === hashA2,
    broadcastThenMined:
      sendA.status === 'broadcast' && (sendAFinal.status === 'mined' || mined.find((m) => m.label === hashA.slice(0, 10))?.status === 'mined'),
    movementBroadcastThenMined: movA.status === 'broadcast' && (movAFinal.status === 'mined' || movA.status === 'broadcast'),
    noDuplicateNonce: nonceSet.size === nonces.length,
    merkleNotNewTx: steps['5_merkle_reclose'].sameTxHash === true && steps['5_merkle_reclose'].samePayload === true,
    merkleAnchoredWhenMined:
      merkleFinal.chainStatus === 'mined' ? merkleFinal.status === 'anchored' : merkleFinal.status === 'sealing',
  };

  console.log(JSON.stringify({ msg: 'polygon_probe', event: 'final', report }, null, 2));
}

main().catch((e) => {
  console.error(JSON.stringify({ msg: 'polygon_probe', event: 'fatal', error: e instanceof Error ? e.message : String(e) }));
  process.exit(1);
});
