import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isMailSender } from './mail-sender';

const mail = {
  createdBy: 'uid-remitente',
  senderName: 'Remitente@Estudio.com',
  replyTo: 'respuestas@estudio.com',
  recipientEmail: 'destinatario@correo.com',
};

test('reconoce al remitente por uid de creación', () => {
  assert.equal(isMailSender({ uid: 'uid-remitente', email: '' }, mail), true);
});

test('reconoce al remitente por email (sin importar mayúsculas)', () => {
  assert.equal(isMailSender({ uid: 'otro', email: 'remitente@estudio.com' }, mail), true);
  assert.equal(isMailSender({ uid: 'otro', email: 'RESPUESTAS@estudio.com' }, mail), true);
});

test('el destinatario no es el remitente', () => {
  assert.equal(isMailSender({ uid: 'uid-dest', email: 'destinatario@correo.com' }, mail), false);
});

test('sin sesión o sin datos nunca es remitente', () => {
  assert.equal(isMailSender(null, mail), false);
  assert.equal(isMailSender({ uid: 'uid-remitente', email: 'x@y.com' }, null), false);
});

test('un uid vacío no coincide con un createdBy ausente', () => {
  assert.equal(isMailSender({ uid: '', email: '' }, { recipientEmail: 'a@b.com' }), false);
  assert.equal(isMailSender({ uid: '', email: '' }, { createdBy: '' }), false);
});
