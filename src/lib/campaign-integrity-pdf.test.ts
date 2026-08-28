import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildActaDestinatarioPdf,
  mixedActaSharesMessageBody,
  normalizeActaBodyText,
  type ActaDestinatarioInput,
} from './campaign-integrity-pdf';
import { PDF_SCHEMA } from './pdf-evidence-format';

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
