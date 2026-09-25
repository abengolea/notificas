import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeContentHash } from './certification';
import { buildSortedChronologyRows } from './certificate-chronology';
import {
  buildEvidenceChainVisual,
  canShowWhatsAppProbatoryPhrase,
  whatsAppScopeExplanation,
} from './evidence-chain';
import { generateCertificatePDF } from './certificate-generator';

function pdfText(buf: ArrayBuffer): string {
  return Buffer.from(buf)
    .toString('latin1')
    .replace(/\\\(/g, '(')
    .replace(/\\\)/g, ')');
}

test('C: la cronología se ordena por timestamp', () => {
  const rows = buildSortedChronologyRows([
    { type: 'read_confirmed', timestamp: '2026-09-25T18:14:42Z' },
    { type: 'whatsapp_sent', timestamp: '2026-09-25T18:13:01Z' },
    { type: 'link_clicked', timestamp: '2026-09-25T18:13:58Z' },
    { type: 'reader_magic_open', timestamp: '2026-09-25T18:14:01Z' },
  ]);
  assert.equal(rows[0].label, 'WhatsApp enviado');
  assert.equal(rows[rows.length - 1].label, 'Se registró confirmación de lectura en el lector');
});

test('D: terminología contenido certificado en PDF y anexo', async () => {
  const body = 'Texto intimado único para terminología.';
  const hash = await computeContentHash(body);
  const blob = await generateCertificatePDF({
    messageId: 'termTest1',
    issuedAt: new Date('2026-09-25T18:00:00Z'),
    evidenceSealed: true,
    mailData: {
      from: 'a@test.com',
      recipientEmail: 'b@test.com',
      message: { subject: 'S', contentText: body },
      delivery: { state: 'accepted', time: '2026-09-25T18:13:00Z' },
      tracking: { token: 'tok' },
      evidenceSnapshotHash: 'a'.repeat(64),
      polygonCertifications: { contentHash: hash, send: '0x' + '1'.repeat(64) },
    },
    movements: [],
    attachments: [],
  });
  const raw = pdfText(await blob.arrayBuffer());
  assert.match(raw, /Contenido certificado mostrado en el lector/);
  assert.match(raw, /contenido certificado/i);
  assert.doesNotMatch(raw, /texto del correo\/lector/i);
  assert.doesNotMatch(raw, /contenido enviado por correo/i);
  assert.match(raw, new RegExp(hash));
});

test('E: WhatsApp referencia messageId y hash en sección dedicada', async () => {
  const body = 'Cuerpo WA ref';
  const hash = await computeContentHash(body);
  const msgId = 'waRefMsg01';
  const blob = await generateCertificatePDF({
    messageId: msgId,
    issuedAt: new Date('2026-09-25T18:00:00Z'),
    evidenceSealed: true,
    mailData: {
      from: 'a@test.com',
      recipientEmail: 'b@test.com',
      recipientPhone: '+5491111111111',
      whatsappMessageId: 'wamid.test',
      message: { subject: 'S', contentText: body },
      delivery: { state: 'accepted', time: '2026-09-25T18:13:00Z' },
      tracking: { token: 'tok' },
      evidenceSnapshotHash: 'b'.repeat(64),
      polygonCertifications: { contentHash: hash, send: '0x' + '2'.repeat(64) },
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
      renderedBody: 'Hola, accede aquí',
      renderedFooter: null,
      variables: [],
      buttons: [{ url: `https://app.test/linkRedirect?msg=${msgId}&k=tok`, urlParameter: null, text: 'Acceder' }],
      templateBodyMissing: false,
    },
  });
  const raw = pdfText(await blob.arrayBuffer());
  assert.match(raw, new RegExp(msgId));
  assert.match(raw, /Mensaje enviado por WhatsApp/);
  assert.match(raw, /hash completo en el anexo técnico/i);
});

test('F: hash abreviado en Parte I y completo en anexo', async () => {
  const body = 'Hash display test';
  const hash = await computeContentHash(body);
  const blob = await generateCertificatePDF({
    messageId: 'hashDisplay',
    issuedAt: new Date('2026-09-25T18:00:00Z'),
    evidenceSealed: true,
    mailData: {
      from: 'a@test.com',
      recipientEmail: 'b@test.com',
      message: { subject: 'S', contentText: body },
      delivery: { state: 'accepted', time: '2026-09-25T18:13:00Z' },
      tracking: { token: 'tok' },
      evidenceSnapshotHash: 'c'.repeat(64),
      polygonCertifications: { contentHash: hash, send: '0x' + '3'.repeat(64) },
    },
    movements: [],
    attachments: [],
  });
  const raw = pdfText(await blob.arrayBuffer());
  assert.match(raw, new RegExp(hash.slice(0, 8)));
  assert.match(raw, new RegExp(hash));
  assert.match(raw, /hash completo en el anexo/i);
});

test('J: cadena sin WhatsApp no incluye paso de WhatsApp', () => {
  const steps = buildEvidenceChainVisual({
    hasWhatsApp: false,
    hasEmail: true,
    messageId: 'emailOnly',
    contentHash: 'd'.repeat(64),
    hasPolygon: true,
  });
  const texts = steps.filter((s) => s.kind === 'line').map((s) => s.text);
  assert.doesNotMatch(texts.join(' '), /WhatsApp enviado/i);
  assert.match(texts.join(' '), /correo electrónico/i);
});

test('frase probatoria WA sólo con click de enlace', () => {
  assert.equal(
    canShowWhatsAppProbatoryPhrase({
      hasWhatsApp: true,
      messageId: 'x',
      contentHash: 'a'.repeat(64),
      whatsappLinkClicked: false,
    }),
    false
  );
  assert.equal(
    canShowWhatsAppProbatoryPhrase({
      hasWhatsApp: true,
      messageId: 'x',
      contentHash: 'a'.repeat(64),
      whatsappLinkClicked: true,
    }),
    true
  );
});

test('alcance WhatsApp usa contenido certificado', () => {
  assert.match(whatsAppScopeExplanation(false, true), /contenido certificado mostrado en el lector/i);
  assert.doesNotMatch(whatsAppScopeExplanation(false, true), /correo\/lector/i);
});
