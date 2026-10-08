import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeContentHash } from './certification';
import { verifyEvidenceConsistency } from './certificate-evidence-consistency';

test('verifyEvidenceConsistency rechaza messageId inconsistente en readerUrl', async () => {
  const result = await verifyEvidenceConsistency({
    messageId: 'abc123',
    mailData: {
      readerUrl: 'https://app.test/reader/OTHER?id=1',
      polygonCertifications: {},
    },
  });
  assert.equal(result.ok, false);
  assert.match(result.critical.join(' '), /readerUrl|OTHER/i);
});

test('verifyEvidenceConsistency rechaza contentHash que no coincide con snapshot sellado', async () => {
  const text = 'Contenido certificado original';
  const hash = await computeContentHash(text);
  const result = await verifyEvidenceConsistency({
    messageId: 'm1',
    mailData: {
      message: { contentText: text },
      polygonCertifications: { contentHash: 'f'.repeat(64) },
      evidenceSnapshotHash: 'a'.repeat(64),
    },
    evidenceSealed: true,
  });
  assert.equal(result.ok, false);
  assert.match(result.critical.join(' '), /contentHash/i);
});

test('verifyEvidenceConsistency acepta registro viejo sin campos opcionales', async () => {
  const result = await verifyEvidenceConsistency({
    messageId: 'legacy1',
    mailData: {
      message: { contentText: 'Texto sin hash registrado' },
    },
    evidenceSealed: false,
  });
  assert.equal(result.ok, true);
  assert.equal(result.critical.length, 0);
});

test('verifyEvidenceConsistency no confunde Message-ID SMTP con el id de Firestore', async () => {
  const smtpId = '<3143ce96-30dd-6e75-c4ba-1a0d2fdff533@notificas.com.ar>';
  const result = await verifyEvidenceConsistency({
    messageId: 'kBNOet9libp3ntbJcZK',
    mailData: {
      tracking: { messageId: smtpId },
      smtpMessageId: smtpId,
      message: { contentText: 'PRUEBA 6' },
    },
  });
  assert.equal(result.ok, true, result.critical.join(' | '));
});

test('verifyEvidenceConsistency rechaza un id de tracking que no es SMTP y no coincide', async () => {
  const result = await verifyEvidenceConsistency({
    messageId: 'kBNOet9libp3ntbJcZK',
    mailData: {
      tracking: { messageId: 'otroDocId' },
    },
  });
  assert.equal(result.ok, false);
  assert.match(result.critical.join(' '), /tracking/);
});

test('verifyEvidenceConsistency valida coincidencia de contentHash', async () => {
  const text = 'Intimación de prueba';
  const hash = await computeContentHash(text);
  const result = await verifyEvidenceConsistency({
    messageId: 'm2',
    mailData: {
      message: { contentText: text },
      polygonCertifications: { contentHash: hash },
    },
    evidenceSealed: true,
    snapshotContentHash: hash,
  });
  assert.equal(result.ok, true);
});
