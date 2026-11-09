import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  contentAccessChannel,
  contentAccessField,
  contentAccessPayloadVia,
  existingContentAccessTx,
} from './polygon-content-access';

const TX_A = '0x' + 'a'.repeat(64);
const TX_B = '0x' + 'b'.repeat(64);

test('los nombres de canal que usa el sistema se normalizan; lo demás no es canal', () => {
  assert.equal(contentAccessChannel('whatsapp'), 'whatsapp');
  assert.equal(contentAccessChannel('email'), 'email');
  assert.equal(contentAccessChannel('correo'), 'email');
  assert.equal(contentAccessChannel('reader'), null);
  assert.equal(contentAccessChannel('attachment'), null);
  assert.equal(contentAccessChannel(undefined), null);
});

test('cada canal tiene su campo; sin canal queda el histórico', () => {
  assert.equal(contentAccessField('whatsapp'), 'contentAccessWhatsapp');
  assert.equal(contentAccessField('email'), 'contentAccessEmail');
  assert.equal(contentAccessField(null), 'contentAccess');
});

test('mensaje sin accesos: ningún canal está cubierto', () => {
  assert.equal(existingContentAccessTx({}, 'whatsapp'), null);
  assert.equal(existingContentAccessTx(undefined, 'email'), null);
  assert.equal(existingContentAccessTx({ send: TX_A }, null), null);
});

test('el acceso por WhatsApp no tapa el acceso por correo (y al revés)', () => {
  const certs = { contentAccessWhatsapp: TX_A };
  assert.equal(existingContentAccessTx(certs, 'whatsapp'), TX_A);
  assert.equal(existingContentAccessTx(certs, 'email'), null);

  const certs2 = { contentAccessEmail: TX_B };
  assert.equal(existingContentAccessTx(certs2, 'email'), TX_B);
  assert.equal(existingContentAccessTx(certs2, 'whatsapp'), null);
});

test('un acceso sin canal conocido (adjunto abierto desde el lector) queda cubierto por cualquier acceso ya anclado', () => {
  assert.equal(existingContentAccessTx({ contentAccessWhatsapp: TX_A }, null), TX_A);
  assert.equal(existingContentAccessTx({ contentAccessEmail: TX_B }, null), TX_B);
  assert.equal(existingContentAccessTx({ contentAccess: TX_A }, null), TX_A);
});

test('mensajes históricos: el campo viejo cubre su propio canal, no el otro', () => {
  const viaWa = { contentAccess: TX_A, contentAccessVia: 'whatsapp' };
  assert.equal(existingContentAccessTx(viaWa, 'whatsapp'), TX_A);
  assert.equal(existingContentAccessTx(viaWa, 'email'), null);

  const viaEmail = { contentAccess: TX_A, contentAccessVia: 'email' };
  assert.equal(existingContentAccessTx(viaEmail, 'email'), TX_A);
  assert.equal(existingContentAccessTx(viaEmail, 'whatsapp'), null);
});

test('mensajes históricos cuya vía no distingue canal no cubren ninguno: cada canal ancla el suyo', () => {
  const viaReader = { contentAccess: TX_A, contentAccessVia: 'reader' };
  assert.equal(existingContentAccessTx(viaReader, 'whatsapp'), null);
  assert.equal(existingContentAccessTx(viaReader, 'email'), null);
  assert.equal(existingContentAccessTx(viaReader, null), TX_A);
});

test('un valor que no es hash de TX (pendiente, vacío) no cuenta como anclado', () => {
  assert.equal(existingContentAccessTx({ contentAccessWhatsapp: true as unknown }, 'whatsapp'), null);
  assert.equal(existingContentAccessTx({ contentAccessEmail: '' }, 'email'), null);
  assert.equal(existingContentAccessTx({ contentAccess: 'pendiente' }, null), null);
});

test('la TX deja escrito el canal aunque el acceso haya sido por el lector o un adjunto', () => {
  assert.equal(contentAccessPayloadVia('reader', 'whatsapp'), 'whatsapp/reader');
  assert.equal(contentAccessPayloadVia('reader', 'email'), 'email/reader');
  assert.equal(contentAccessPayloadVia('attachment', 'email'), 'email/attachment');
  assert.equal(contentAccessPayloadVia('whatsapp', 'whatsapp'), 'whatsapp');
  assert.equal(contentAccessPayloadVia('email', 'email'), 'email');
  assert.equal(contentAccessPayloadVia(undefined, 'whatsapp'), 'whatsapp');
  assert.equal(contentAccessPayloadVia('reader', null), 'reader');
  assert.equal(contentAccessPayloadVia(undefined, null), undefined);
});
