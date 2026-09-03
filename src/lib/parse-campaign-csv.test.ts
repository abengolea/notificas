import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseCsvQuickResult,
  presentRecipientValue,
  recipientValueText,
} from './parse-campaign-csv';

const CSV = `telefono,nombre,dni,fecha,monto,cuotas
+5493364645357,Adrian Bengolea,25715970,14/02/26,130000,1
`;

test('CSV GOcuotas: cuotas=1 queda en el destinatario', () => {
  const parsed = parseCsvQuickResult(CSV, 'whatsapp', ['fecha', 'monto', 'cuotas']);
  assert.equal(parsed.error, null);
  assert.equal(parsed.rows.length, 1);
  assert.equal(parsed.rows[0].cuotas, '1');
  assert.equal(parsed.rows[0].monto, '130000');
  assert.equal(parsed.rows[0].nombre, 'Adrian Bengolea');
});

test('no persiste columnas ajenas al mapeo ni a los campos de template', () => {
  const csv = `telefono,nombre,dni,cuotas,notas_internas
+5493364645357,Adrian Bengolea,25715970,1,secreto
`;
  const parsed = parseCsvQuickResult(csv, 'whatsapp', ['cuotas']);
  assert.equal(parsed.rows[0].cuotas, '1');
  assert.equal((parsed.rows[0] as unknown as Record<string, unknown>).notas_internas, undefined);
});

test('cuotas 0 se conserva (no es vacío)', () => {
  const csv = `telefono,nombre,dni,cuotas
+5493364645357,Adrian Bengolea,25715970,0
`;
  const parsed = parseCsvQuickResult(csv, 'whatsapp', ['cuotas']);
  assert.equal(parsed.rows[0].cuotas, '0');
  assert.equal(presentRecipientValue(parsed.rows[0].cuotas), true);
  assert.equal(recipientValueText(0), '0');
  assert.equal(presentRecipientValue(''), false);
  assert.equal(presentRecipientValue(undefined), false);
});

test('pegar solo datos sin encabezado explica que falta la primera fila', () => {
  const parsed = parseCsvQuickResult(
    '3364645357,Adrian Bengolea,abengolea@hotmail.com,12/2/26,18283,4',
    'ambos',
    ['fecha', 'monto', 'cuotas']
  );
  assert.match(String(parsed.error), /encabezado/i);
  assert.match(String(parsed.error), /telefono/);
  assert.match(String(parsed.error), /email/);
  assert.match(String(parsed.error), /dni/);
});
