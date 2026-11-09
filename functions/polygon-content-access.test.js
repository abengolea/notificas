const { test } = require('node:test');
const assert = require('node:assert/strict');
const { contentAccessChannel, contentAccessAlreadyCertified } = require('./polygon-content-access');

const TX_A = '0x' + 'a'.repeat(64);
const TX_B = '0x' + 'b'.repeat(64);

test('normaliza el canal', () => {
  assert.equal(contentAccessChannel('whatsapp'), 'whatsapp');
  assert.equal(contentAccessChannel('email'), 'email');
  assert.equal(contentAccessChannel('correo'), 'email');
  assert.equal(contentAccessChannel('attachment'), null);
});

test('el acceso por un canal no tapa el del otro', () => {
  assert.equal(contentAccessAlreadyCertified({ contentAccessWhatsapp: TX_A }, 'whatsapp'), true);
  assert.equal(contentAccessAlreadyCertified({ contentAccessWhatsapp: TX_A }, 'email'), false);
  assert.equal(contentAccessAlreadyCertified({ contentAccessEmail: TX_B }, 'whatsapp'), false);
});

test('mensaje sin accesos anclados: hay que certificar', () => {
  assert.equal(contentAccessAlreadyCertified({}, 'whatsapp'), false);
  assert.equal(contentAccessAlreadyCertified(undefined, 'email'), false);
  assert.equal(contentAccessAlreadyCertified({ send: TX_A }, null), false);
});

test('mensajes históricos: el campo viejo cubre solo el canal de su vía', () => {
  const viaEmail = { contentAccess: TX_A, contentAccessVia: 'email' };
  assert.equal(contentAccessAlreadyCertified(viaEmail, 'email'), true);
  assert.equal(contentAccessAlreadyCertified(viaEmail, 'whatsapp'), false);
  const viaReader = { contentAccess: TX_A, contentAccessVia: 'reader' };
  assert.equal(contentAccessAlreadyCertified(viaReader, 'whatsapp'), false);
  assert.equal(contentAccessAlreadyCertified(viaReader, null), true);
});

test('un acceso sin canal queda cubierto por cualquier acceso ya anclado', () => {
  assert.equal(contentAccessAlreadyCertified({ contentAccessEmail: TX_B }, null), true);
});
