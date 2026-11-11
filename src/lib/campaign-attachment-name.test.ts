import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildAttachmentReport,
  describeAttachmentReportProblem,
  normalizeAttachmentName,
} from './campaign-attachment-name';

describe('normalizeAttachmentName', () => {
  it('ignora carpetas, mayúsculas y espacios en los bordes', () => {
    assert.equal(normalizeAttachmentName('  Carpeta/Sub\\Recibo_Juan.PDF '), 'recibo_juan.pdf');
  });

  it('unifica acentos compuestos y descompuestos', () => {
    assert.equal(normalizeAttachmentName('Liquidación.pdf'), normalizeAttachmentName('Liquidación.pdf'));
  });

  it('devuelve vacío para null o undefined', () => {
    assert.equal(normalizeAttachmentName(undefined), '');
    assert.equal(normalizeAttachmentName(null), '');
  });
});

describe('buildAttachmentReport', () => {
  it('ok cuando cada fila tiene su archivo', () => {
    const r = buildAttachmentReport({
      rowNames: ['a.pdf', 'B.pdf'],
      fileNames: ['A.PDF', 'b.pdf'],
    });
    assert.equal(r.ok, true);
    assert.equal(r.rowsMissingFile, 0);
    assert.equal(describeAttachmentReportProblem(r), '');
  });

  it('cuenta filas sin nombre y filas con archivo faltante', () => {
    const r = buildAttachmentReport({
      rowNames: ['a.pdf', '', undefined, 'falta.pdf', 'falta.pdf'],
      fileNames: ['a.pdf', 'sobra.pdf'],
    });
    assert.equal(r.ok, false);
    assert.equal(r.rowsWithoutName, 2);
    assert.equal(r.rowsMissingFile, 2);
    assert.deepEqual(r.missingFileNames, ['falta.pdf']);
    assert.deepEqual(r.unusedFileNames, ['sobra.pdf']);
    assert.equal(r.unusedFiles, 1);
    assert.match(describeAttachmentReportProblem(r), /2 filas no tienen/);
  });

  it('avisa los archivos que comparten varias personas', () => {
    const r = buildAttachmentReport({
      rowNames: ['igual.pdf', 'IGUAL.pdf', 'otro.pdf'],
      fileNames: ['igual.pdf', 'otro.pdf'],
    });
    assert.equal(r.ok, true);
    assert.deepEqual(r.sharedFileNames, ['igual.pdf']);
  });

  it('una lista vacía no es ok', () => {
    const r = buildAttachmentReport({ rowNames: [], fileNames: ['a.pdf'] });
    assert.equal(r.ok, false);
    assert.equal(describeAttachmentReportProblem(r), 'La lista no tiene destinatarios.');
  });

  it('limita las muestras', () => {
    const rowNames = Array.from({ length: 50 }, (_, i) => `f${i}.pdf`);
    const r = buildAttachmentReport({ rowNames, fileNames: [], sampleSize: 5 });
    assert.equal(r.missingFileNames.length, 5);
    assert.equal(r.rowsMissingFile, 50);
  });
});
