import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { inspectCampaignCsv, parseCsvQuickResult } from './parse-campaign-csv';

const CSV = [
  'nombre,email,dni,adjunto',
  'Juan Pérez,juan@empresa.com,30123456,recibo_30123456.pdf',
  'Ana Gómez,ana@empresa.com,28111222,',
  'Luis Díaz,luis@empresa.com,27999888,  Recibo_27999888.PDF ',
].join('\n');

describe('columna adjunto del CSV', () => {
  it('se guarda en cada destinatario, recortada y sin vacíos', () => {
    const r = parseCsvQuickResult(CSV, 'email');
    assert.equal(r.error, null);
    assert.equal(r.rows.length, 3);
    assert.equal(r.rows[0].adjunto, 'recibo_30123456.pdf');
    assert.equal(r.rows[1].adjunto, undefined);
    assert.equal(r.rows[2].adjunto, 'Recibo_27999888.PDF');
  });

  it('inspectCampaignCsv avisa si hay columna y cuántas filas la usan', async () => {
    const file = new File([CSV], 'lista.csv', { type: 'text/csv' });
    const r = await inspectCampaignCsv(file, 'email');
    assert.equal(r.error, null);
    assert.equal(r.hasAdjuntoColumn, true);
    assert.equal(r.adjuntoRows, 2);
    assert.equal(r.count, 3);
  });

  it('un CSV sin la columna no la reporta', async () => {
    const file = new File(['nombre,email,dni\nJuan,juan@empresa.com,1'], 'lista.csv', { type: 'text/csv' });
    const r = await inspectCampaignCsv(file, 'email');
    assert.equal(r.hasAdjuntoColumn, false);
    assert.equal(r.adjuntoRows, 0);
  });
});
