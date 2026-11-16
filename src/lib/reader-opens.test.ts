import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readerOpenRowLabel, readerOpensFromMovements } from './reader-opens';

test('toma solo las aperturas del lector y conserva el origen registrado', () => {
  const opens = readerOpensFromMovements([
    { type: 'email_sent', timestamp: '2026-11-15T19:44:23.247Z' },
    { type: 'reader_magic_open', source: 'reader_email', clickSource: 'correo', timestamp: '2026-11-15T19:45:33.499Z' },
    { type: 'link_clicked', source: 'email', timestamp: '2026-11-15T19:45:34.646Z' },
    { type: 'read_confirmed', timestamp: '2026-11-15T19:45:45.107Z' },
  ]);
  assert.deepEqual(opens, [{ at: '2026-11-15T19:45:33.499Z', source: 'correo' }]);
});

test('entrar por los dos canales da dos aperturas ordenadas por hora', () => {
  const opens = readerOpensFromMovements([
    { type: 'reader_magic_open', source: 'reader_whatsapp', clickSource: 'whatsapp', timestamp: '2026-11-15T20:10:00.000Z' },
    { type: 'reader_magic_open', source: 'reader_email', clickSource: 'correo', timestamp: '2026-11-15T20:05:00.000Z' },
  ]);
  assert.deepEqual(
    opens.map((o) => o.source),
    ['correo', 'whatsapp']
  );
});

test('sin origen guardado queda unknown: no se deduce', () => {
  const opens = readerOpensFromMovements([{ type: 'reader_magic_open', timestamp: '2026-11-15T20:05:00.000Z' }]);
  assert.equal(opens[0].source, 'unknown');
  assert.match(readerOpenRowLabel('unknown'), /origen no determinado/);
});

test('entradas inválidas o sin hora no generan aperturas', () => {
  assert.deepEqual(readerOpensFromMovements(undefined), []);
  assert.deepEqual(readerOpensFromMovements('x'), []);
  assert.deepEqual(readerOpensFromMovements([null, { type: 'reader_magic_open' }, { type: 'reader_magic_open', timestamp: 'basura' }]), []);
});

test('los rótulos dicen solo lo que el registro sabe', () => {
  assert.equal(readerOpenRowLabel('correo'), 'Lector abierto desde el correo');
  assert.equal(readerOpenRowLabel('whatsapp'), 'Lector abierto desde WhatsApp');
});
