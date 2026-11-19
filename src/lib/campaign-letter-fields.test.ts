import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  campaignLetterTexts,
  checkLetterVariables,
  contextAroundNumericPlaceholder,
  csvColumnsFromLetterText,
  describeNumericLetterPlaceholders,
  letterPlaceholders,
  mergeCsvColumns,
  numericLetterPlaceholders,
  readRecipientExtras,
  recipientExtraFields,
  replaceNumericLetterPlaceholders,
} from './campaign-letter-fields';
import { personalizeCampaignText } from './campaign-email-html';
import { renderCampaignMessageBody } from './campaign-mixed-message';
import { parseCsvQuickResult } from './parse-campaign-csv';

const LETTER = 'Dr. {{nombre}}: adeuda las matrículas {{anios_adeudados}}. Regularice antes del {{fecha}}. {{1}}';

test('letterPlaceholders: minúsculas, sin repetir y sin los {{N}} de Meta', () => {
  assert.deepEqual(letterPlaceholders([LETTER, '{{Nombre}} {{dias_atraso}}']), [
    'nombre',
    'anios_adeudados',
    'fecha',
    'dias',
  ]);
});

test('csvColumnsFromLetterText pide las columnas propias y deja afuera las de contacto y las del sistema', () => {
  assert.deepEqual(
    csvColumnsFromLetterText(['Hola {{nombre}} {{dni}} {{email}} {{remitente}} {{url_lectura}}', LETTER]),
    ['anios_adeudados', 'fecha']
  );
});

test('mergeCsvColumns une sin repetir y normaliza dias_atraso', () => {
  assert.deepEqual(mergeCsvColumns(['fecha', 'dias_atraso'], ['Fecha', 'anios_adeudados', 'dias']), [
    'fecha',
    'dias',
    'anios_adeudados',
  ]);
});

test('personalizeCampaignText reemplaza columnas propias y deja las desconocidas', () => {
  const out = personalizeCampaignText(LETTER, {
    nombre: 'Ana Pérez',
    fecha: '18 de diciembre',
    anios_adeudados: '2021, 2022 y 2023',
  });
  assert.equal(out, 'Dr. Ana Pérez: adeuda las matrículas 2021, 2022 y 2023. Regularice antes del 18 de diciembre. {{1}}');
  assert.equal(personalizeCampaignText('{{otra_cosa}} {{monto}}', { nombre: 'Ana' }), '{{otra_cosa}} ');
});

test('personalizeCampaignText no se confunde con claves heredadas del objeto', () => {
  assert.equal(personalizeCampaignText('{{constructor}} {{__proto__}}', { nombre: 'Ana' }), '{{constructor}} {{__proto__}}');
});

test('recipientExtraFields guarda área y columnas propias, no los campos de siempre', () => {
  const extras = recipientExtraFields({
    email: 'a@b.com',
    nombre: 'Ana',
    dni: '1',
    monto: '5',
    adjunto: 'a.pdf',
    area: 'Legales',
    anios_adeudados: ' 2021, 2022 ',
    vacio: '',
    'Raro-Nombre': 'x',
    __meta__: 'x',
  });
  assert.deepEqual(extras, { area: 'Legales', anios_adeudados: '2021, 2022' });
});

test('readRecipientExtras tolera datos que no son un mapa', () => {
  assert.deepEqual(readRecipientExtras(null), {});
  assert.deepEqual(readRecipientExtras(['a']), {});
  assert.deepEqual(readRecipientExtras({ anios: '2024', n: 3 }), { anios: '2024', n: '3' });
});

test('checkLetterVariables frena si a alguien le falta un dato de la carta', () => {
  const rows = [
    { nombre: 'Ana', email: 'a@b.com', anios_adeudados: '2021', fecha: '18/12' },
    { nombre: 'Beto', email: 'b@b.com', fecha: '18/12' },
    { nombre: 'Cora', email: 'c@b.com', anios_adeudados: '  ', fecha: '18/12' },
  ];
  const check = checkLetterVariables({ texts: ['Asunto {{nombre}}', LETTER], rows });
  assert.equal(check.ok, false);
  assert.equal(check.problems.length, 1);
  assert.equal(check.problems[0].field, 'anios_adeudados');
  assert.equal(check.problems[0].affected, 2);
  assert.deepEqual(check.problems[0].sample, ['Beto', 'Cora']);
  assert.match(check.message, /anios_adeudados/);
  assert.equal(checkLetterVariables({ texts: [LETTER], rows: [rows[0]] }).ok, true);
});

test('checkLetterVariables: 0 cuenta como dato y las variables del sistema no se piden', () => {
  const ok = checkLetterVariables({
    texts: ['{{remitente}} {{monto}}'],
    rows: [{ nombre: 'Ana', monto: '0' }],
  });
  assert.equal(ok.ok, true);
});

const META_STYLE_LETTER =
  'Hola {{1}}. Te informamos que registrás una deuda pendiente de ${{2}}, correspondiente a {{3}} cuota(s) vencida(s).\nTe solicitamos regularizar el pago dentro del plazo de {{4}}.';

test('numericLetterPlaceholders detecta los {{N}} de Meta que la carta no completa', () => {
  assert.deepEqual(numericLetterPlaceholders([META_STYLE_LETTER, 'Asunto {{nombre}} {{ 2 }}']), [1, 2, 3, 4]);
  assert.deepEqual(numericLetterPlaceholders(['Hola {{nombre}}']), []);
  assert.match(describeNumericLetterPlaceholders([1, 3]), /\{\{1\}\}, \{\{3\}\}/);
  assert.equal(describeNumericLetterPlaceholders([]), '');
});

test('replaceNumericLetterPlaceholders pasa {{N}} a columnas con nombre o a texto fijo', () => {
  const out = replaceNumericLetterPlaceholders(META_STYLE_LETTER, {
    1: 'nombre',
    2: 'monto',
    3: 'cuotas',
    4: ' Plazo ',
  });
  assert.equal(
    out,
    'Hola {{nombre}}. Te informamos que registrás una deuda pendiente de ${{monto}}, correspondiente a {{cuotas}} cuota(s) vencida(s).\nTe solicitamos regularizar el pago dentro del plazo de {{plazo}}.'
  );
  assert.equal(replaceNumericLetterPlaceholders('Plazo {{4}}', { 4: '=5 días' }), 'Plazo 5 días');
  // Sin dato asignado, o con un nombre inválido, queda como está.
  assert.equal(replaceNumericLetterPlaceholders('A {{1}} B {{2}}', { 2: '!!' }), 'A {{1}} B {{2}}');
  assert.equal(replaceNumericLetterPlaceholders('A {{1}}', { 1: '=  ' }), 'A {{1}}');
});

test('la carta convertida usa las columnas del CSV, incluida la propia (plazo)', () => {
  const letter = replaceNumericLetterPlaceholders(META_STYLE_LETTER, { 1: 'nombre', 2: 'monto', 3: 'cuotas', 4: 'plazo' });
  assert.deepEqual(csvColumnsFromLetterText([letter]), ['monto', 'cuotas', 'plazo']);
  const csv = [
    'telefono,nombre,monto,cuotas,plazo,email,dni,legajo',
    '+5493364645357,Adrian Bengolea,125000,4,5 dias,abengolea1@gmail.com,25715970,GC000001',
  ].join('\n');
  const parsed = parseCsvQuickResult(csv, 'ambos', csvColumnsFromLetterText([letter]));
  assert.equal(parsed.error, null);
  const row = { ...readRecipientExtras(recipientExtraFields(parsed.rows[0])), ...parsed.rows[0] };
  assert.equal(
    personalizeCampaignText(letter, row),
    'Hola Adrian Bengolea. Te informamos que registrás una deuda pendiente de $125000, correspondiente a 4 cuota(s) vencida(s).\nTe solicitamos regularizar el pago dentro del plazo de 5 dias.'
  );
  assert.equal(checkLetterVariables({ texts: [letter], rows: parsed.rows }).ok, true);
});

test('contextAroundNumericPlaceholder muestra las palabras que rodean al {{N}}', () => {
  assert.match(contextAroundNumericPlaceholder(META_STYLE_LETTER, 4), /plazo de \[4\]\./);
  assert.equal(contextAroundNumericPlaceholder('sin variables', 1), '');
});

test('campaignLetterTexts: con «mismo texto» la carta no se usa y WhatsApp-only no tiene carta', () => {
  const base = { asunto: 'A {{nombre}}', cuerpo: 'C {{anios}}', waTemplateName: 'mi_plantilla' };
  assert.deepEqual(campaignLetterTexts({ ...base, canal: 'email' }), ['A {{nombre}}', 'C {{anios}}']);
  assert.deepEqual(campaignLetterTexts({ ...base, canal: 'ambos', mixedMode: 'same_text' }), ['A {{nombre}}', '']);
  assert.deepEqual(campaignLetterTexts({ ...base, canal: 'ambos', mixedMode: 'email_text_wa_reader' }), [
    'A {{nombre}}',
    'C {{anios}}',
  ]);
  assert.deepEqual(campaignLetterTexts({ ...base, canal: 'whatsapp' }), []);
});

test('el CSV con columna propia llega hasta la carta del correo y del lector', () => {
  const csv = [
    'telefono,nombre,email,dni,anios_adeudados,fecha',
    '+5491112345678,Ana Pérez,ana@mail.com,30111222,"2021",18 de diciembre',
  ].join('\n');
  const extra = csvColumnsFromLetterText([LETTER]);
  const parsed = parseCsvQuickResult(csv, 'ambos', extra);
  assert.equal(parsed.error, null);
  const stored = recipientExtraFields(parsed.rows[0]);
  assert.equal(stored.anios_adeudados, '2021');
  // Lo que arma el worker: extras guardados + campos de siempre.
  assert.equal(parsed.rows[0].fecha, '18 de diciembre');
  const row = { ...readRecipientExtras(stored), email: 'ana@mail.com', nombre: 'Ana Pérez', fecha: parsed.rows[0].fecha };
  const letter = renderCampaignMessageBody({
    canal: 'ambos',
    waTemplateName: 'mi_plantilla',
    mixedMode: 'email_text_wa_reader',
    cuerpo: LETTER,
    row,
  });
  assert.equal(letter, 'Dr. Ana Pérez: adeuda las matrículas 2021. Regularice antes del 18 de diciembre. {{1}}');
});

test('el CSV sin la columna que usa la carta se rechaza con el nombre de la columna', () => {
  const csv = 'telefono,nombre,email,dni\n+5491112345678,Ana,ana@mail.com,30111222';
  const parsed = parseCsvQuickResult(csv, 'ambos', csvColumnsFromLetterText([LETTER]));
  assert.match(String(parsed.error), /anios_adeudados/);
});
