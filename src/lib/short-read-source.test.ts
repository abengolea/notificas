import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { mailWasSentByWhatsApp, resolveShortReadSource } from './short-read-source';
import { whatsappClickTrackUrl, whatsappCtaPageResponse } from './whatsapp-read-http';

test('?src=email explícito gana, aunque el mensaje también haya salido por WhatsApp', () => {
  assert.equal(resolveShortReadSource('email', { whatsappMessageId: 'wamid.1' }, true), 'email');
});

test('?src=whatsapp explícito gana', () => {
  assert.equal(resolveShortReadSource('whatsapp', { tracking: null }, true), 'whatsapp');
});

test('sin marca y mensaje solo por correo: el clic es del correo (correos viejos)', () => {
  assert.equal(resolveShortReadSource(null, { tracking: {} }, true), 'email');
  assert.equal(resolveShortReadSource('', {}, true), 'email');
});

test('sin marca y mensaje enviado por WhatsApp: se mantiene WhatsApp', () => {
  assert.equal(resolveShortReadSource(null, { whatsappMessageId: 'wamid.1' }, true), 'whatsapp');
  assert.equal(resolveShortReadSource(null, { tracking: { whatsappMessageId: 'wamid.1' } }, true), 'whatsapp');
  assert.equal(resolveShortReadSource(null, { waRequestSnapshot: { to: '+54' } }, true), 'whatsapp');
  assert.equal(resolveShortReadSource(null, { waOnly: true }, true), 'whatsapp');
});

test('si no se pudo leer el mensaje, se mantiene el comportamiento histórico', () => {
  assert.equal(resolveShortReadSource(null, null, false), 'whatsapp');
});

test('mailWasSentByWhatsApp ignora valores vacíos', () => {
  assert.equal(mailWasSentByWhatsApp({ whatsappMessageId: '  ' }), false);
  assert.equal(mailWasSentByWhatsApp(null), false);
});

test('la URL de seguimiento y el redirect al lector llevan el origen elegido', () => {
  assert.match(whatsappClickTrackUrl('m1', 'tok', 'email'), /&src=email$/);
  assert.match(whatsappClickTrackUrl('m1', 'tok'), /&src=whatsapp$/);

  const req = new NextRequest('https://notificas.com.ar/n/ABCDEFGH');
  const emailDest = whatsappCtaPageResponse(req, 'm1', 'tok', 'email').headers.get('location') || '';
  assert.match(emailDest, /\/reader\/m1\?k=tok&from=email$/);
  const waDest = whatsappCtaPageResponse(req, 'm1', 'tok').headers.get('location') || '';
  assert.match(waDest, /&from=whatsapp$/);
});
