import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildActaDestinatarioPdf,
  buildActaTandaPdf,
  loteClosingSentence,
  lotePositiveStatement,
  mixedActaSharesMessageBody,
  normalizeActaBodyText,
  type ActaDestinatarioInput,
  type ActaTandaInput,
} from './campaign-integrity-pdf';
import { PDF_SCHEMA } from './pdf-evidence-format';
import { digestOfLeafHashes, LotePdfIntegrityError } from './lote-leaf-hash';
import { SITE_CONTACT } from './seo';

const LEAF0 = '6e89dba05b35007c27a46faa3a2ae6dca7c4e91b02f8d6e1c3b5a0947e12f8d1';
const LEAF1 = '6674fe9083f21f5accaf5e3d66fdc47c91aa0c4b7e3d2f1806c5b9a1d4e7f203';
const LEAF2 = 'f8bfab33d97d3e57a2cc0543de5690f60b1e4c7a9d2f8351c6a0e4b7d9f12c48';

const BODY =
  'Hola Adrian Bengolea, DNI 25715970.\nPor medio de la presente le notificamos que, a la fecha 12/2/26, su cuenta registra una deuda de $18283, correspondiente a 4 cuota(s) vencida(s) e impaga(s), con más de 180 días de mora.';

function sampleMixed(overrides: Partial<ActaDestinatarioInput> = {}): ActaDestinatarioInput {
  return {
    orgNombre: 'EMpresa Prueba',
    orgCuit: '33-71729868-9',
    campaignId: 'camp1',
    campaignNombre: 'Msjs prueba mixto',
    campaignAsunto: 'menaje prueba',
    generatedAt: '2026-08-28T23:19:52Z (28/08/2026, 20:19:52 ART)',
    messageId: 'KGwgIzKPUVscFoenjPNv',
    canal: 'ambos',
    recipientNombre: 'Adrian Bengolea',
    recipientEmail: 'abengolea@hotmail.com',
    recipientTelefono: '+5493364645357',
    recipientDni: '25715970',
    asuntoPersonalizado: 'menaje prueba',
    cuerpoPersonalizado: BODY,
    whatsappSent: {
      templateName: 'notificacion_deuda_180_dias',
      templateLang: 'es_AR',
      templateHash: 'abc',
      templateId: '1393418889653150',
      renderedBody: BODY,
      renderedHeader: 'NOTIFICACIÓN FEHACIENTE CON FINES FISCALES',
      renderedFooter: 'GOcuotas',
      variables: [
        { n: 1, field: 'nombre', value: 'Adrian Bengolea' },
        { n: 5, field: 'cuotas', value: '4' },
      ],
      buttons: [],
    },
    evidenceSealed: true,
    smtpMessageId: '<e03a6127-7702-1f54-741b-0046c156035c@notificas.com.ar>',
    wamid: 'wamid.HBgNNTQ5MzM2NDY0NTM1NxUCABEYEjM2OEZCODFCREIzNUFBMEVENAA=',
    phoneNumberId: '693302653873170',
    wabaId: '2169826596871026',
    chronology: {
      emailEnviadoAt: '2026-08-28T23:12:43Z',
      emailLeidoAt: '2026-08-28T23:18:41Z',
      waEnviadoAt: '2026-08-28T23:12:43Z',
      waEntregadoAt: '2026-08-28T23:12:44Z',
      waLeidoAt: '2026-08-28T23:12:52Z',
    },
    intact: true,
    summary: 'íntegro',
    contentHash: 'f8219b3e109953dd73e870f7fa0eec40dff48da75327c585b03dc8845db7c9c3',
    storedHash: 'f8219b3e109953dd73e870f7fa0eec40dff48da75327c585b03dc8845db7c9c3',
    contentMatch: true,
    send: {
      batchId: 'b1',
      txHash: '0xabc',
      merkleRoot: '1a0b',
      leafHash: 'leaf',
      merkleValid: true,
      onChainMatch: true,
    },
    events: [],
    ...overrides,
  };
}

function pdfText(buf: ArrayBuffer): string {
  return Buffer.from(buf)
    .toString('latin1')
    .replace(/\\\(/g, '(')
    .replace(/\\\)/g, ')');
}

test('normalizeActaBodyText ignora saltos y espacios', () => {
  assert.equal(normalizeActaBodyText('Hola  \n  Ana'), 'Hola Ana');
});

test('mixedActaSharesMessageBody detecta el mismo BODY de Meta', () => {
  assert.equal(mixedActaSharesMessageBody(BODY, BODY), true);
  assert.equal(mixedActaSharesMessageBody(BODY, `  ${BODY}  \n`), true);
  assert.equal(mixedActaSharesMessageBody(BODY, 'otro texto'), false);
  assert.equal(mixedActaSharesMessageBody('', BODY), false);
});

test('acta mixta con el mismo cuerpo no lo imprime dos veces ni dice Contenido exacto enviado', async () => {
  const buf = await buildActaDestinatarioPdf(sampleMixed());
  const raw = pdfText(buf);
  const phrase = 'vencida';
  const copies = raw.split(phrase).length - 1;
  assert.equal(copies, 1, `el cuerpo mixto debía aparecer una vez, apareció ${copies}`);
  assert.match(raw, /18283/);
  assert.equal(raw.includes('Contenido exacto enviado'), false);
  assert.equal(raw.includes('Contenido enviado por correo (lector)'), false);
  assert.match(raw, /Canal WhatsApp/);
  assert.match(raw, /Canal correo electr/);
  assert.match(raw, /común a correo y WhatsApp/);
  assert.match(raw, /no un único mensaje duplicado/);
  assert.match(raw, /Encabezado \(WhatsApp\)/);
  assert.match(raw, /Pie \(WhatsApp\)/);
  assert.match(raw, /ID SMTP del correo/);
  assert.match(raw, /WAMID de WhatsApp/);
  assert.match(raw, /acta-individual\/v7/);
  assert.equal(PDF_SCHEMA.actaIndividual, 'acta-individual/v7');
});

test('acta mixta con textos distintos conserva ambos cuerpos etiquetados', async () => {
  const buf = await buildActaDestinatarioPdf(
    sampleMixed({
      cuerpoPersonalizado: 'Solo el correo: abra el lector.',
      whatsappSent: {
        templateName: 'notificaciones_notificas',
        templateLang: 'es_AR',
        renderedBody: 'Globo distinto de WhatsApp para Ana.',
        variables: [],
        buttons: [],
      },
    })
  );
  const raw = pdfText(buf);
  assert.match(raw, /Solo el correo: abra el lector/);
  assert.match(raw, /Globo distinto de WhatsApp para Ana/);
  assert.match(raw, /Canal WhatsApp/);
  assert.match(raw, /Canal correo electr/);
  assert.equal(raw.includes('Contenido exacto enviado'), false);
});

async function sampleLote(overrides: Partial<ActaTandaInput> = {}): Promise<ActaTandaInput> {
  const digest = await digestOfLeafHashes([LEAF0, LEAF1, LEAF2]);
  return {
    orgNombre: 'Empresa Prueba',
    orgCuit: '30-12345678-1',
    campaignId: 'lI0lgwrTLUgTcJb0FWya',
    campaignNombre: 'PRUEBA',
    templateName: 'notificacion_deuda_180_dias',
    templateHash: 'aa'.repeat(32),
    batchId: 'events-2026-11-03',
    kind: 'event',
    status: 'anchored',
    leafCount: 3,
    merkleRoot: '674c39747813b927fb5a2ddc3c11ecb8c1fe5bfc445f9f0f1a4d244b15b0e0df',
    txHash: '0xc5c162591a0a69ad84daf9d7922ea07892f4eb29d4da33780ce07cf3ea536af4',
    txFrom: '0xAbC0000000000000000000000000000000000001',
    blockNumber: 78123456,
    blockTime: '2026-11-03T22:37:13.000Z',
    payload: `CAMPAIGN_EVENT|v2|lI0lgwrTLUgTcJb0FWya|events-2026-11-03|674c39747813b927fb5a2ddc3c11ecb8c1fe5bfc445f9f0f1a4d244b15b0e0df|3|2026-11-03T22:37:04.016Z|${digest}`,
    generatedAt: '2026-11-03T22:55:48Z (03/11/2026, 19:55:48 ART)',
    leaves: [
      {
        leafIndex: 0,
        messageId: 'm1',
        leafHash: LEAF0,
        eventType: 'wa_delivered',
        occurredAt: '2026-11-03T22:36:41Z',
        nombre: 'Adrian Bengolea',
        email: '',
        telefono: '+5493364645357',
        dni: '25715970',
      },
      {
        leafIndex: 1,
        messageId: 'm2',
        leafHash: LEAF1,
        eventType: 'wa_delivered',
        occurredAt: '2026-11-03T22:36:53Z',
        nombre: 'Gregorio Bengolea',
        email: '',
        telefono: '+5493364219129',
        dni: '11111111',
      },
      {
        leafIndex: 2,
        messageId: 'm3',
        leafHash: LEAF2,
        eventType: 'wa_delivered',
        occurredAt: '2026-11-03T22:36:48Z',
        nombre: 'Paula Alva',
        email: '',
        telefono: '+5493364312520',
        dni: '22222222',
      },
    ],
    ...overrides,
  };
}

test('el lote dice entregas, no lecturas, y no deja asunto con variables', async () => {
  const input = await sampleLote();
  const sentence = loteClosingSentence(input);
  assert.match(sentence, /3 entregas de WhatsApp/);
  assert.match(sentence, /El lote quedó anclado en Polygon/);
  assert.equal(/lectura/i.test(sentence), false);
  const positive = lotePositiveStatement(input);
  assert.match(positive, /delivered/);
  assert.match(positive, /19:36:41/);
  assert.match(positive, /19:36:53/);
});

test('constancia de lote: cara de índice, teléfonos tapados, hashes reales', async () => {
  const buf = await buildActaTandaPdf(await sampleLote());
  const raw = pdfText(buf);
  assert.match(raw, /Constancia t/);
  assert.match(raw, /integridad del lote/);
  assert.equal(/Acta de integridad/.test(raw), false);
  assert.equal(raw.includes('{{nombre}}'), false);
  assert.equal(/HECHOS \(recepci/.test(raw), false);
  assert.match(raw, /Notificas SRL/);
  assert.match(raw, new RegExp(SITE_CONTACT.cuit.replace(/-/g, '\\-')));
  assert.match(raw, /Empresa Prueba/);
  assert.match(raw, /30-12345678-1/);
  assert.equal(raw.includes('notificacion_deuda_180_dias'), false);
  assert.match(raw, /ART \(UTC-3\)/);
  assert.match(raw, /WhatsApp entregado/);
  assert.match(raw, /\+54 9 336 \*\*\*-\*357/);
  assert.match(raw, /Gregorio Bengolea/);
  assert.match(raw, new RegExp(LEAF0));
  assert.match(raw, /CAMPAIGN_EVENT\|v2\|/);
  assert.match(raw, /leavesDigest: las hojas impresas coinciden/);
  assert.match(raw, /sin saltos/);
  assert.match(raw, /spec\/v2/);
  assert.match(raw, /leaf=/);
  assert.match(raw, /Bloque 78123456/);
  assert.match(raw, /0xAbC0000000000000000000000000000000000001/);
  assert.match(raw, /acta-tanda\/v5/);
  assert.equal(PDF_SCHEMA.actaTanda, 'acta-tanda/v5');
});

test('no genera el PDF si el hash de hoja está truncado o el digest no cierra', async () => {
  const truncated = await sampleLote();
  truncated.leaves[0].leafHash = LEAF0.slice(0, 32);
  await assert.rejects(() => buildActaTandaPdf(truncated), LotePdfIntegrityError);

  const padded = await sampleLote();
  padded.leaves[2].leafHash = LEAF2.slice(0, 32) + '3'.repeat(32);
  await assert.rejects(() => buildActaTandaPdf(padded), LotePdfIntegrityError);
});

test('CUIT de cliente inválido no se imprime; el emisor sigue siendo Notificas', async () => {
  const raw = pdfText(await buildActaTandaPdf(await sampleLote({ orgCuit: '30-12345678-9' })));
  assert.match(raw, /Notificas SRL/);
  assert.match(raw, /33-71729868-9/);
  assert.equal(raw.includes('30-12345678-9'), false);
});

