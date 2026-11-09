import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeContentHash } from './certification';
import { generateCertificatePDF } from './certificate-generator';
import { tokenReference } from './evidence-chain';
import { maskAccessKeys, REDACTED_ACCESS_KEY, redactWhatsAppSentForPrint } from './redact-access-key';

const SECRET = 'SECRETKEYabcdef1234567890zz';

function pdfText(buf: ArrayBuffer): string {
  return Buffer.from(buf).toString('latin1').replace(/\\\(/g, '(').replace(/\\\)/g, ')');
}

test('maskAccessKeys tapa k= en URLs completas y relativas', () => {
  assert.equal(
    maskAccessKeys(`https://app.test/reader/abc?k=${SECRET}&from=email`),
    `https://app.test/reader/abc?k=${REDACTED_ACCESS_KEY}&from=email`,
  );
  assert.equal(
    maskAccessKeys(`/linkRedirect?msg=abc&k=${SECRET}&src=whatsapp`),
    `/linkRedirect?msg=abc&k=${REDACTED_ACCESS_KEY}&src=whatsapp`,
  );
});

test('maskAccessKeys tapa el token literal aunque no vaya como k=', () => {
  assert.equal(maskAccessKeys(`token ${SECRET} fin`, SECRET), `token ${REDACTED_ACCESS_KEY} fin`);
});

test('maskAccessKeys no toca otros parámetros ni texto sin clave', () => {
  const url = 'https://app.test/verify?id=abc&hash=123&kind=mail';
  assert.equal(maskAccessKeys(url), url);
  assert.equal(maskAccessKeys(''), '');
});

test('redactWhatsAppSentForPrint tapa la clave en botones, variables y globo', () => {
  const out = redactWhatsAppSentForPrint(
    {
      templateName: 't',
      templateLang: 'es',
      templateHash: null,
      templateId: null,
      renderedHeader: null,
      renderedBody: `Entre: https://app.test/reader/x?k=${SECRET}`,
      renderedFooter: null,
      templateBodyMissing: false,
      variables: [{ n: 1, field: 'link', value: `/reader/x?k=${SECRET}` }],
      buttons: [
        { text: 'Abrir', url: `https://app.test/linkRedirect?msg=x&k=${SECRET}`, urlParameter: null },
        { text: 'Abrir', url: null, urlParameter: `/linkRedirect?msg=x&k=${SECRET}&src=whatsapp` },
      ],
    },
    SECRET,
  );
  assert.equal(JSON.stringify(out).includes(SECRET), false);
  assert.match(JSON.stringify(out), /clave reservada/);
});

test('el certificado PDF no imprime la clave del enlace y sí una referencia', async () => {
  const body = 'Texto certificado para la prueba de clave.';
  const hash = await computeContentHash(body);
  const msgId = 'keyLeakMsg01';
  const blob = await generateCertificatePDF({
    messageId: msgId,
    issuedAt: new Date('2026-09-25T18:00:00Z'),
    evidenceSealed: true,
    mailData: {
      from: 'a@test.com',
      recipientEmail: 'b@test.com',
      recipientPhone: '+5491111111111',
      whatsappMessageId: 'wamid.test',
      readerUrl: `https://app.test/reader/${msgId}?k=${SECRET}`,
      message: { subject: 'S', contentText: body },
      delivery: { state: 'accepted', time: '2026-09-25T18:13:00Z' },
      tracking: { token: SECRET },
      evidenceSnapshotHash: 'd'.repeat(64),
      polygonCertifications: { contentHash: hash, send: '0x' + '4'.repeat(64) },
      waRequestSnapshot: {
        template: { name: 'notificaciones_notificas', language: { code: 'es_AR' } },
        to: '+5491111111111',
      },
    },
    movements: [{ type: 'whatsapp_sent', timestamp: '2026-09-25T18:13:01Z' }],
    attachments: [],
    whatsappSent: {
      templateName: 'notificaciones_notificas',
      templateLang: 'es_AR',
      templateHash: null,
      templateId: null,
      renderedHeader: null,
      renderedBody: 'Cuerpo del aviso.',
      renderedFooter: null,
      variables: [],
      buttons: [
        { url: `https://app.test/linkRedirect?msg=${msgId}&k=${SECRET}`, urlParameter: `/linkRedirect?msg=${msgId}&k=${SECRET}`, text: 'Acceder' },
      ],
      templateBodyMissing: false,
    },
  });
  const raw = pdfText(await blob.arrayBuffer());
  assert.equal(raw.includes(SECRET), false, 'la clave completa no puede quedar en el PDF');
  assert.ok(raw.includes(tokenReference(SECRET)!), 'debe imprimirse la referencia no reversible');
  assert.match(raw, /clave reservada/);
  assert.match(raw, new RegExp(msgId), 'el ID del mensaje sigue visible');
});
