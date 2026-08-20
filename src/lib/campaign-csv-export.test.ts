import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'crypto';
import { csvEscape, csvRow } from './campaign-export-csv';
import {
  campaignCsvFileName,
  campaignCsvStoragePrefix,
  csvExportDocId,
  formatCsvBytes,
  sanitizeExportSlug,
  sha256Incremental,
  sha256Hex,
} from './campaign-csv-export';

test('slug de archivo sanitiza caracteres peligrosos', () => {
  assert.equal(sanitizeExportSlug('Prueba Familia 2026', 'abc'), 'prueba-familia-2026');
  assert.match(sanitizeExportSlug('../etc/passwd.csv', 'id1'), /passwd|id1|etc/);
  assert.ok(!sanitizeExportSlug('a/b\\c:d', 'x').includes('/'));
  assert.ok(!sanitizeExportSlug('a/b\\c:d', 'x').includes('\\'));
});

test('nombre y ruta de Storage versionados', () => {
  const name = campaignCsvFileName('Prueba Familia', '2yBpfXYZ', 3, new Date('2026-08-19T15:00:00-03:00'));
  assert.match(name, /prueba-familia-2026-08-19-resultados-v3\.csv/);
  assert.equal(campaignCsvStoragePrefix('org1', 'camp1', 2), 'campaign-exports/org1/camp1/v2');
  assert.equal(csvExportDocId(4), 'v4');
});

test('SHA-256 incremental coincide con el buffer completo', () => {
  const csv = `\uFEFF${csvRow(['N°', 'Nombre'])}\r\n${csvRow([1, 'García, "José"'])}\r\n`;
  const buf = Buffer.from(csv, 'utf8');
  const chunks = [buf.subarray(0, 10), buf.subarray(10, 25), buf.subarray(25)];
  assert.equal(sha256Incremental(chunks), sha256Hex(buf));
  assert.equal(sha256Incremental(chunks), createHash('sha256').update(buf).digest('hex'));
});

test('CSV con comas, comillas, tildes y saltos', () => {
  assert.equal(csvEscape('GOcuotas, Legales'), '"GOcuotas, Legales"');
  assert.equal(csvEscape('dijo "hola"'), '"dijo ""hola"""');
  assert.equal(csvEscape('José\nMaría'), '"José\nMaría"');
  assert.equal(csvEscape('áéíóú ñ'), 'áéíóú ñ');
});

test('formatCsvBytes', () => {
  assert.equal(formatCsvBytes(512), '512 B');
  assert.match(formatCsvBytes(1500), /KB/);
  assert.match(formatCsvBytes(180 * 1024 * 1024), /MB/);
});
