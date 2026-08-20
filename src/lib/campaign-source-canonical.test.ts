import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sourceRowCanonical, pipeSafe } from './campaign-source-canonical';
import { buildSendLeafPayload, parseSendLeafPayload } from './campaign-leaf-payload';

test('canonical de fila GOcuotas es estable', () => {
  const a = sourceRowCanonical({
    email: 'A@X.com',
    nombre: 'Juan Perez',
    dni: '25.715.970',
    telefono: '+5491112345678',
    monto: '100000',
    cuotas: '4',
    fecha: '15/08/2026',
  });
  const b = sourceRowCanonical({
    email: 'a@x.com',
    nombre: 'Juan Perez',
    dni: '25715970',
    telefono: '5491112345678',
    monto: '100000',
    cuotas: '4',
    fecha: '15/08/2026',
  });
  assert.equal(a, b);
  assert.match(a, /^ROW\|v1\|25715970\|/);
});

test('pipeSafe no deja colar pipes', () => {
  assert.equal(pipeSafe('a|b'), 'a/b');
});

test('hoja v2 incluye dni y monto y se puede parsear', () => {
  const payload = buildSendLeafPayload({
    campaignId: 'c1',
    messageId: 'm1',
    email: 'a@x.com',
    phone: '+5491112345678',
    contentHash: 'aa'.repeat(32),
    attachmentHashes: [],
    smtpMessageId: '',
    wamid: 'wamid.ABC',
    waBodyHash: 'bb'.repeat(32),
    templateSealHash: 'cc'.repeat(32),
    dni: '25715970',
    nombre: 'Juan Perez',
    monto: '100000',
    cuotas: '4',
    rowHash: 'dd'.repeat(32),
  });
  assert.equal(payload.startsWith('v2|send|'), true);
  const parsed = parseSendLeafPayload(payload);
  assert.ok(parsed);
  assert.equal(parsed.dni, '25715970');
  assert.equal(parsed.monto, '100000');
  assert.equal(parsed.cuotas, '4');
  assert.equal(parsed.wamid, 'wamid.ABC');
  assert.equal(parsed.nombre, 'Juan Perez');
});

test('parse v1 no inventa dni', () => {
  const parsed = parseSendLeafPayload(
    'v1|send|c1|m1|a@x.com|5491112345678|contenthash|att|smtp|wamid.X|wabody|tpl'
  );
  assert.ok(parsed);
  assert.equal(parsed.version, 'v1');
  assert.equal(parsed.dni, '');
  assert.equal(parsed.wamid, 'wamid.X');
});
