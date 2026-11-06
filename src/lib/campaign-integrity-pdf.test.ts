import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildActaDestinatarioPdf,
  buildActaTandaPdf,
  loteClosingSentence,
  lotePositiveStatement,
  mixedActaSharesMessageBody,
  normalizeActaBodyText,
  printedActaBody,
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


const PARAS =
  'Hola Ana, DNI 1.\n\nPor medio de la presente le notificamos una deuda.\n\nSi ya regularizó su deuda, por favor descarte este mensaje.';

test('printedActaBody conserva las líneas en blanco que entran en el contentHash', async () => {
  const { sha256Hex } = await import('./merkle');
  assert.equal(printedActaBody(`  ${PARAS}\n`), PARAS);
  assert.equal(await sha256Hex(printedActaBody(PARAS)), await sha256Hex(PARAS));
  // lo sellado se transcribe tal cual, también si trae etiquetas: nada de limpiar lo que entró en el hash
  const html = '<p>Hola  Ana</p>\n\n<p>Chau</p>';
  assert.equal(printedActaBody(html), html);
  assert.equal(await sha256Hex(printedActaBody(html)), await sha256Hex(html));
});

test('el anexo imprime preimagen, camino Merkle y TX completas, sin truncar', async () => {
  const { sha256Hex, buildMerkleTree, getMerkleProof } = await import('./merkle');
  const sendPayload = 'v2|send|camp1|msg1|ana@example.com|5493364000000|1|Ana|100|1||' + 'a'.repeat(64) + '||<id@x>|wamid.X|' + 'b'.repeat(64) + '|' + 'c'.repeat(64);
  const sendLeaf = await sha256Hex(sendPayload);
  const other = await sha256Hex('otra');
  const tree = await buildMerkleTree([other, sendLeaf]);
  const proof = getMerkleProof(tree.layers, 1);
  const tx1 = '0x' + '12bd1f389356806e0af7c775f07d290588e57d8a200445bc6245152479a214a1'.slice(0, 64);
  const tx2 = '0xc5c162591a0a69ad84daf9d7922ea07892f4eb29d4da33780ce07cf3ea536af4';
  const hash = await sha256Hex(PARAS);
  const buf = await buildActaDestinatarioPdf(
    sampleMixed({
      cuerpoPersonalizado: PARAS,
      contentHash: hash,
      storedHash: hash,
      send: {
        batchId: 'send-0',
        txHash: tx2,
        merkleRoot: tree.root,
        leafHash: sendLeaf,
        leafPayload: sendPayload,
        leafIndex: 1,
        proof,
        templateSealHash: 'c'.repeat(64),
        merkleValid: true,
        onChainMatch: true,
      },
      events: [
        {
          type: 'wa_delivered',
          present: true,
          occurredAt: '2026-11-03T22:36:41Z',
          merkleValid: true,
          txHash: tx1,
          batchId: 'events-2026-11-03',
          merkleRoot: tree.root,
          leafHash: other,
          leafPayload: 'v1|event|camp1|msg1|wa_delivered|2026-11-03T22:36:41Z|' + sendLeaf,
          leafIndex: 0,
          proof: [sendLeaf],
        },
      ],
    })
  );
  const raw = pdfText(buf);
  assert.match(raw, /Prueba de pertenencia al árbol/);
  assert.ok(raw.includes(tx1), 'la TX del evento debe figurar completa');
  assert.ok(raw.includes(tx2), 'la TX de envío debe figurar completa');
  assert.ok(raw.includes(sendLeaf));
  assert.ok(raw.includes(proof[0]), 'el hermano del camino debe estar impreso entero');
  assert.ok(raw.includes(tree.root));
  assert.ok(raw.includes('wamid.X'), 'la preimagen de la hoja debe estar impresa');
  assert.equal(raw.includes('...'), false, 'no puede haber hashes ni TX recortados con puntos suspensivos');
  assert.match(raw, /reproduce la huella de contenido/);
});

test('sin preimagen guardada el anexo lo dice en vez de omitirlo', async () => {
  const buf = await buildActaDestinatarioPdf(
    sampleMixed({
      send: {
        batchId: 'b1',
        txHash: '0x' + 'ab'.repeat(32),
        merkleRoot: 'cd'.repeat(32),
        leafHash: 'ef'.repeat(32),
        leafPayload: null,
        leafIndex: 0,
        proof: null,
        merkleValid: null,
        onChainMatch: null,
      },
    })
  );
  const raw = pdfText(buf);
  assert.match(raw, /Preimagen no disponible en el registro/);
  assert.match(raw, /Sin camino Merkle registrado/);
});

test('la tabla de hechos no dice Sí cuando no hay prueba Merkle', async () => {
  const buf = await buildActaDestinatarioPdf(
    sampleMixed({
      events: [{ type: 'wa_read', present: true, occurredAt: '2026-11-03T22:37:30Z', merkleValid: null, batchId: 'events-x' }],
    })
  );
  const raw = pdfText(buf);
  const row = raw.slice(raw.indexOf('Hechos posteriores anclados'));
  assert.match(row, /Pendiente/);
});

test('el texto separa la copia al enviar de la publicación en Polygon y no usa "inalterable" ni "lacre"', async () => {
  const ind = pdfText(
    await buildActaDestinatarioPdf(sampleMixed({ send: { ...sampleMixed().send, txHash: '0x' + 'ab'.repeat(32) } }))
  );
  assert.match(ind, /Publicación de la huella/);
  assert.match(ind, /Copia guardada al enviar/);
  assert.match(ind, /la fecha cierta que aporta la cadena es la de ese bloque/);
  assert.equal(/inalterable|lacre/i.test(ind), false);
  const sinPublicar = pdfText(await buildActaDestinatarioPdf(sampleMixed({ send: { ...sampleMixed().send, txHash: null } })));
  assert.match(sinPublicar, /todavía no se publicó en Polygon/);

  const lote = pdfText(await buildActaTandaPdf(await sampleLote()));
  assert.match(lote, /las horas de la tabla son las de cada hecho/);
  assert.match(lote, /no la del servidor ni la de cada fila de la tabla/);
});

test('el rango de "delivered" del lote usa solo las entregas, no las horas de lectura', async () => {
  const base = await sampleLote({ kind: 'event' });
  const input = {
    ...base,
    leaves: [
      { ...base.leaves[0], eventType: 'wa_delivered', occurredAt: '2026-11-03T22:37:06Z' },
      { ...base.leaves[1], eventType: 'wa_delivered', occurredAt: '2026-11-03T23:36:54Z' },
      { ...base.leaves[2], eventType: 'wa_read', occurredAt: '2026-11-03T23:40:45Z' },
      { ...base.leaves[2], eventType: 'wa_read', occurredAt: '2026-11-03T22:41:28Z' },
    ],
  };
  const statement = lotePositiveStatement(input);
  assert.match(statement, /«delivered» para 2 mensajes/);
  assert.match(statement, /entre 03\/11\/2026, 19:37:06 y 03\/11\/2026, 20:36:54 ART/);
  assert.equal(statement.includes('20:40:45'), false, 'la hora de una lectura no puede cerrar el rango de entregas');
  assert.match(statement, /informó lectura de WhatsApp para 2/);
});
