import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyCampaignLimit } from './campaign-limit';

test('WhatsApp 429 / 130429 / 131056 pausan', () => {
  assert.equal(classifyCampaignLimit({ httpStatus: 429, message: 'rate limit' })?.source, 'whatsapp');
  assert.equal(classifyCampaignLimit({ errorCode: 130429, message: 'rate limit' })?.source, 'whatsapp');
  assert.equal(classifyCampaignLimit({ errorCode: '131056', message: '(#131056) pair rate' })?.source, 'whatsapp');
  assert.equal(classifyCampaignLimit({ limitHit: true, limitSource: 'whatsapp', message: 'x' })?.source, 'whatsapp');
  assert.equal(classifyCampaignLimit({ errorCode: 132015, message: 'template paused' })?.source, 'whatsapp');
});

test('errores de destinatario no pausan', () => {
  assert.equal(classifyCampaignLimit({ errorCode: 131026, message: '(#131026) Message undeliverable' }), null);
  assert.equal(classifyCampaignLimit({ errorCode: 131008, message: '(#131008) Falta un parámetro' }), null);
  assert.equal(classifyCampaignLimit({ message: 'Sin teléfono WhatsApp' }), null);
});

test('Polygon sin POL pausa', () => {
  assert.equal(classifyCampaignLimit({ message: 'INSUFFICIENT_FUNDS' })?.source, 'polygon');
  assert.equal(classifyCampaignLimit({ message: '❌ Sin balance POL. Necesitas POL' })?.source, 'polygon');
});

test('GCP quota / Cloud Tasks 429 pausan', () => {
  assert.equal(classifyCampaignLimit({ message: '8 RESOURCE_EXHAUSTED' })?.source, 'gcp');
  assert.equal(classifyCampaignLimit({ message: 'Cloud Tasks API error 429: Rate exceeded' })?.source, 'gcp');
  assert.equal(classifyCampaignLimit({ message: 'storage/quota-exceeded' })?.source, 'gcp');
});
