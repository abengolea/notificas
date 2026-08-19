const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  asWaText,
  isEmptyWaParam,
  resolveWhatsAppTemplateValue,
  buildWhatsAppBodyParameters,
} = require('./wa-template-vars');

const MAPPING = ['nombre', 'dni', 'fecha', 'monto', 'cuotas'];

test('cuotas=1 del CSV llega a {{5}} como "1", no vacío', () => {
  const rd = {
    nombre: 'Adrian Bengolea',
    dni: '25715970',
    fecha: '14/02/26',
    monto: '130000',
    cuotas: '1',
  };
  assert.equal(resolveWhatsAppTemplateValue('cuotas', rd, '', '', '', ''), '1');

  const built = buildWhatsAppBodyParameters({
    templateVariables: MAPPING,
    urlButton: false,
    recipientData: rd,
    recipientName: rd.nombre,
    toPhone: '+5493364645357',
    readerUrl: 'https://example.test/r',
    senderName: 'GOcuotas',
  });
  assert.equal(built.error, null);
  assert.equal(built.parameters[4].text, '1');
  assert.equal(built.resolved[4].field, 'cuotas');
  assert.equal(built.resolved[4].n, 5);
});

test('cuotas 0 no se trata como vacío', () => {
  assert.equal(asWaText(0), '0');
  assert.equal(asWaText('0'), '0');
  assert.equal(isEmptyWaParam('0'), false);
  assert.equal(isEmptyWaParam(''), true);
  assert.equal(isEmptyWaParam(undefined), true);

  const built = buildWhatsAppBodyParameters({
    templateVariables: MAPPING,
    urlButton: false,
    recipientData: { nombre: 'A', dni: '1', fecha: '1', monto: '1', cuotas: 0 },
    recipientName: 'A',
    toPhone: '+5491111111111',
    readerUrl: 'https://example.test/r',
    senderName: 'X',
  });
  assert.equal(built.error, null);
  assert.equal(built.parameters[4].text, '0');
});

test('cuotas undefined bloquea el envío (131008)', () => {
  const built = buildWhatsAppBodyParameters({
    templateVariables: MAPPING,
    urlButton: false,
    recipientData: { nombre: 'A', dni: '1', fecha: '1', monto: '1' },
    recipientName: 'A',
    toPhone: '+5491111111111',
    readerUrl: 'https://example.test/r',
    senderName: 'X',
  });
  assert.ok(built.error);
  assert.equal(built.error.code, 131008);
  assert.match(built.error.message, /\{\{5\}\} \(cuotas\)/);
});
