import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  asLeafHash,
  assertPrintedLoteIntegrity,
  digestOfLeafHashes,
  LotePdfIntegrityError,
} from './lote-leaf-hash';

const H0 = '6e89dba05b35007c27a46faa3a2ae6dca7c4e91b02f8d6e1c3b5a0947e12f8d1';
const H1 = '6674fe9083f21f5accaf5e3d66fdc47c91aa0c4b7e3d2f1806c5b9a1d4e7f203';
const H2 = 'f8bfab33d97d3e57a2cc0543de5690f60b1e4c7a9d2f8351c6a0e4b7d9f12c48';

test('asLeafHash rechaza truncado y no-hex; 64 hex se aceptan aunque sean repetidos', () => {
  assert.equal(asLeafHash(H0, 'h'), H0);
  assert.equal(asLeafHash('1'.repeat(64), 'h'), '1'.repeat(64));
  assert.throws(() => asLeafHash('6e89dba05b35007c27a46faa3a2ae6dc', 'h'), LotePdfIntegrityError);
  assert.throws(() => asLeafHash('zz'.repeat(32), 'h'), LotePdfIntegrityError);
  assert.throws(() => asLeafHash('6e89dba05b35007c27a46faa3a2ae6dc' + 'x'.repeat(32), 'h'), LotePdfIntegrityError);
});

test('assertPrintedLoteIntegrity compara el digest con las hojas impresas', async () => {
  const digest = await digestOfLeafHashes([H0, H1, H2]);
  const payload = `CAMPAIGN_EVENT|v2|camp|batch|${'ab'.repeat(32)}|3|2026-11-03T22:37:04.016Z|${digest}`;
  const ok = await assertPrintedLoteIntegrity({
    payload,
    leaves: [{ leafHash: H0 }, { leafHash: H1 }, { leafHash: H2 }],
  });
  assert.equal(ok.computedDigest, digest);
  assert.equal(ok.payloadDigest, digest);

  await assert.rejects(
    () =>
      assertPrintedLoteIntegrity({
        payload,
        leaves: [
          { leafHash: H0 },
          { leafHash: H1 },
          { leafHash: 'f8bfab33d97d3e57a2cc0543de5690f6' + '3'.repeat(32) },
        ],
      }),
    LotePdfIntegrityError
  );
});
