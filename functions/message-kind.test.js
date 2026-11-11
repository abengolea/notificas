const { test } = require('node:test');
const assert = require('node:assert/strict');
const { normalizeMessageKind, messageDisclaimerText, plainTextNotice } = require('./message-kind');

test('sin tipo (mensajes viejos) se usa notificación', () => {
  assert.equal(normalizeMessageKind(undefined), 'notificacion');
  assert.equal(normalizeMessageKind('otra cosa'), 'notificacion');
  assert.equal(normalizeMessageKind('intimacion'), 'intimacion');
});

test('el texto plano nombra el mensaje con el tipo elegido en todos lados', () => {
  const t = plainTextNotice({
    kind: 'intimacion',
    sender: 'Colegio',
    recipientName: 'Ana',
    recipientEmail: 'ana@x.com',
    readerUrl: 'https://notificas.com.ar/n/ABCDEFGH?src=email',
    year: 2026,
  });
  assert.match(t, /^INTIMACIÓN\nNueva intimación para usted/);
  assert.match(t, /Colegio le envió una intimación\./);
  assert.match(t, /Acceder a la intimación: https:\/\/notificas\.com\.ar\/n\/ABCDEFGH\?src=email/);
  assert.match(t, /Importante: este correo contiene una intimación cuyo contenido/);
  assert.equal(/notificación|comunicación/i.test(t.replace('Notificas', '')), false);
  assert.equal(t.includes(messageDisclaimerText('intimacion')), true);
});

test('el texto plano no incluye el email del destinatario y termina con el enlace a la web', () => {
  const t = plainTextNotice({
    kind: 'notificacion',
    sender: 'Colegio',
    recipientName: 'Ana',
    recipientEmail: 'persona.privada@ejemplo.com',
    readerUrl: 'https://notificas.com.ar/n/ABCDEFGH?src=email',
    year: 2026,
  });
  assert.equal(t.includes('persona.privada@ejemplo.com'), false);
  assert.match(t, /Visitar nuestra web: https:\/\/notificas\.com\.ar$/);
});
