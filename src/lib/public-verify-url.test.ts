import { test } from 'node:test';
import assert from 'node:assert/strict';
import { publicCertificateVerifyUrl, verifyQueryFromSearchParams } from './public-verify-url';

test('URL de certificado 1:1 incluye id y kind', () => {
  const url = publicCertificateVerifyUrl({ id: 'abc', kind: 'mail_certificate' });
  assert.match(url, /\/verify\?/);
  assert.match(url, /id=abc/);
  assert.match(url, /kind=mail_certificate/);
});

test('URL de acta de tanda usa campaignId y batchId', () => {
  const url = publicCertificateVerifyUrl({
    campaignId: 'camp1',
    batchId: 'batch9',
    kind: 'campaign_acta',
  });
  assert.match(url, /campaignId=camp1/);
  assert.match(url, /batchId=batch9/);
  assert.match(url, /kind=campaign_acta/);
});

test('parsea query del validador', () => {
  const q = verifyQueryFromSearchParams(
    new URLSearchParams('id=m1&campaignId=c1&batchId=b1&kind=campaign_acta_recipient')
  );
  assert.equal(q.id, 'm1');
  assert.equal(q.campaignId, 'c1');
  assert.equal(q.batchId, 'b1');
  assert.equal(q.kind, 'campaign_acta_recipient');
});
