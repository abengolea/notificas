import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatCuit, isValidCuit } from './cuit';
import { SITE_CONTACT } from './seo';

test('CUIT de Notificas SRL cierra el dígito verificador', () => {
  assert.equal(isValidCuit(SITE_CONTACT.cuit), true);
  assert.equal(formatCuit(SITE_CONTACT.cuit), '33-71729868-9');
});

test('30-12345678-9 es inválido; el verificador correcto es 1', () => {
  assert.equal(isValidCuit('30-12345678-9'), false);
  assert.equal(formatCuit('30-12345678-9'), null);
  assert.equal(formatCuit('30-12345678-1'), '30-12345678-1');
});
