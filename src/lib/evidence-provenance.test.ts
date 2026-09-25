import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeContentHash } from './certification';
import {
  buildAccessEvidenceFields,
  buildEvidenceChainLine,
  certifiedContentLegend,
  tokenReference,
  whatsAppReaderLinkExplanation,
} from './evidence-chain';
import { overlayMailWithSnapshot, type EvidenceSnapshot } from './evidence-snapshot';
import { certificatePlainBody, generateCertificatePDF } from './certificate-generator';

const MESSAGE_ID = 'msgProbatory001';
const CONTENT = 'Texto intimado original certificado.';
const WAMID = 'wamid.HBgNNTQ5MTE1NDYyOTYxFQIAEhggTest123';
const SNAPSHOT_HASH = 'a'.repeat(64);
const CONTENT_HASH_PLACEHOLDER = 'b'.repeat(64);

function baseSnapshot(overrides: Partial<EvidenceSnapshot> = {}): EvidenceSnapshot {
  return {
    mailId: MESSAGE_ID,
    sealedAt: '2026-09-24T12:00:00.000Z',
    sender: {
      uid: 'uid1',
      email: 'rem@example.com',
      orgId: null,
      orgNombre: 'Org',
      orgCuit: '30123456789',
    },
    recipient: {
      nombre: 'Dest',
      email: 'dest@example.com',
      phone: '+5492215462961',
      dni: '12345678',
      legajo: '',
    },
    channel: 'both',
    subject: 'Intimación',
    contentText: CONTENT,
    contentHash: CONTENT_HASH_PLACEHOLDER,
    attachments: [],
    attachmentHashes: [],
    whatsapp: {
      templateName: 'notificacion',
      templateLang: 'es_AR',
      templateVariables: ['Dest'],
      requestSnapshot: { template: { name: 'notificacion' } },
      bodyHash: 'c'.repeat(64),
      wamid: WAMID,
      phoneNumberId: '123',
      wabaId: '456',
    },
    smtp: { messageId: '<smtp@test>', accepted: true },
    snapshotHash: SNAPSHOT_HASH,
    campaignId: null,
    campaignMessageId: null,
    ...overrides,
  };
}

function pdfText(buf: ArrayBuffer): string {
  return Buffer.from(buf)
    .toString('latin1')
    .replace(/\\\(/g, '(')
    .replace(/\\\)/g, ')');
}

test('A: WhatsApp URL contiene el messageId del envío', () => {
  const readerUrl = `https://app.notificas.com/reader/${encodeURIComponent(MESSAGE_ID)}?k=token&kind=whatsapp`;
  assert.match(readerUrl, new RegExp(MESSAGE_ID));
  const evidence = buildAccessEvidenceFields(
    { polygonCertifications: { contentHash: CONTENT_HASH_PLACEHOLDER }, evidenceSnapshotHash: SNAPSHOT_HASH },
    MESSAGE_ID,
    'mov-1',
    { linkKind: 'whatsapp_link', token: 'secret-token' }
  );
  assert.equal(evidence.messageId, MESSAGE_ID);
});

test('B: enlace certificado apunta al reader del mismo messageId', () => {
  const link = `https://r.notificas.com/l?msg=${MESSAGE_ID}&k=tok&src=wa`;
  assert.match(link, new RegExp(`msg=${MESSAGE_ID}`));
  const chain = buildEvidenceChainLine({
    hasWhatsApp: true,
    messageId: MESSAGE_ID,
    contentHash: CONTENT_HASH_PLACEHOLDER,
    snapshotHash: SNAPSHOT_HASH,
    hasPolygon: true,
  });
  assert.match(chain, new RegExp(MESSAGE_ID));
});

test('C: overlay del reader usa snapshot.contentText', () => {
  const live = {
    message: { contentText: 'TEXTO EDITADO POSTERIOR', content: '<p>TEXTO EDITADO</p>' },
    whatsappMessageId: 'wamid-vivo-distinto',
  };
  const overlaid = overlayMailWithSnapshot(live, baseSnapshot());
  assert.equal(overlaid.message.contentText, CONTENT);
  assert.equal(overlaid.message.content, CONTENT);
  assert.equal(overlaid.evidenceSealed, true);
});

test('D: SHA-256 del texto del reader coincide con contentHash del snapshot', async () => {
  const hash = await computeContentHash(CONTENT);
  const snap = baseSnapshot({ contentHash: hash });
  const overlaid = overlayMailWithSnapshot({ message: { contentText: 'otro' } }, snap);
  const readerHash = await computeContentHash(String(overlaid.message.contentText));
  assert.equal(readerHash, hash);
  assert.equal(snap.contentHash, hash);
});

test('E: WAMID del snapshot se preserva en overlay', () => {
  const overlaid = overlayMailWithSnapshot({ whatsappMessageId: 'wamid-vivo' }, baseSnapshot());
  assert.equal(overlaid.whatsappMessageId, WAMID);
});

test('F: evento whatsapp_link_clicked vincula messageId y hashes', () => {
  const movementId = 'click-uuid';
  const evidence = buildAccessEvidenceFields(
    {
      polygonCertifications: { contentHash: CONTENT_HASH_PLACEHOLDER },
      evidenceSnapshotHash: SNAPSHOT_HASH,
      whatsappMessageId: WAMID,
      recipientPhone: '+5492215462961',
      tracking: { token: 'tok' },
    },
    MESSAGE_ID,
    movementId,
    { linkKind: 'whatsapp_link', token: 'tok' }
  );
  assert.equal(evidence.messageId, MESSAGE_ID);
  assert.equal(evidence.wamid, WAMID);
  assert.equal(evidence.contentHash, CONTENT_HASH_PLACEHOLDER);
  assert.equal(evidence.snapshotHash, SNAPSHOT_HASH);
  assert.equal(evidence.movementId, movementId);
});

test('G: evento reader_access vincula messageId', () => {
  const evidence = buildAccessEvidenceFields(
    {
      polygonCertifications: { contentHash: CONTENT_HASH_PLACEHOLDER },
      evidenceSnapshotHash: SNAPSHOT_HASH,
    },
    MESSAGE_ID,
    'reader-mov',
    { linkKind: 'reader', token: 'tok' }
  );
  assert.equal(evidence.messageId, MESSAGE_ID);
  assert.equal(evidence.linkKind, 'reader');
  assert.ok(evidence.tokenRef);
  assert.notEqual(evidence.tokenRef, 'tok');
});

test('H: snapshotHash no cambia tras overlay', () => {
  const snap = baseSnapshot();
  const overlaid = overlayMailWithSnapshot({ evidenceSnapshotHash: 'vivo' }, snap);
  assert.equal(overlaid.evidenceSnapshotHash, SNAPSHOT_HASH);
});

test('I: contentHash registrado proviene del snapshot', () => {
  const hash = 'd'.repeat(64);
  const overlaid = overlayMailWithSnapshot(
    { polygonCertifications: { contentHash: 'vivo' } },
    baseSnapshot({ contentHash: hash })
  );
  assert.equal((overlaid.polygonCertifications as { contentHash: string }).contentHash, hash);
});

test('J: editar mail operativo no altera contenido mostrado por overlay', () => {
  const snap = baseSnapshot();
  const live = {
    message: { contentText: 'MODIFICADO DESPUÉS DEL ENVÍO', content: '<p>MODIFICADO</p>' },
  };
  const readerView = overlayMailWithSnapshot(live, snap);
  assert.equal(readerView.message.contentText, CONTENT);
  assert.notEqual(live.message.contentText, CONTENT);
});

test('K: certificado PDF imprime texto del snapshot una sola vez como contenido jurídico', async () => {
  const hash = await computeContentHash(CONTENT);
  const blob = await generateCertificatePDF({
    messageId: MESSAGE_ID,
    issuedAt: new Date('2026-09-24T18:00:00.000Z'),
    evidenceSealed: true,
    mailData: {
      from: 'rem@example.com',
      recipientEmail: 'dest@example.com',
      recipientPhone: '+5492215462961',
      whatsappMessageId: WAMID,
      message: { subject: 'Intimación', contentText: CONTENT, content: CONTENT },
      delivery: { state: 'accepted', time: '2026-09-24T12:00:00Z' },
      tracking: { token: 'tok', movements: [{ type: 'whatsapp_sent', timestamp: '2026-09-24T12:01:00Z' }] },
      evidenceSnapshotHash: SNAPSHOT_HASH,
      polygonCertifications: { contentHash: hash, send: '0x' + '1'.repeat(64) },
      readerUrl: `https://app.notificas.com/reader/${MESSAGE_ID}?k=tok`,
      waRequestSnapshot: { template: { name: 'notificacion' }, to: '+5492215462961' },
    },
    movements: [
      { type: 'whatsapp_sent', timestamp: '2026-09-24T12:01:00Z' },
      { type: 'whatsapp_link_clicked', timestamp: '2026-09-24T12:05:00Z' },
      { type: 'reader_magic_open', timestamp: '2026-09-24T12:05:02Z' },
    ],
    attachments: [],
  });
  const raw = pdfText(await blob.arrayBuffer());
  assert.match(raw, /Contenido certificado mostrado en el lector/);
  assert.match(raw, /Mensaje enviado por WhatsApp/);
  assert.match(raw, new RegExp(CONTENT.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(raw, new RegExp(MESSAGE_ID));
  assert.match(raw, new RegExp(hash.slice(0, 16)));
  assert.match(raw, new RegExp(SNAPSHOT_HASH.slice(0, 16)));
});

test('L: certificado incluye WAMID, cadena y no duplica título de contenido correo', async () => {
  const hash = await computeContentHash(CONTENT);
  const blob = await generateCertificatePDF({
    messageId: MESSAGE_ID,
    issuedAt: new Date('2026-09-24T18:00:00.000Z'),
    evidenceSealed: true,
    mailData: {
      from: 'rem@example.com',
      recipientEmail: 'dest@example.com',
      recipientPhone: '+5492215462961',
      whatsappMessageId: WAMID,
      message: { subject: 'Intimación', contentText: CONTENT },
      delivery: { state: 'accepted', time: '2026-09-24T12:00:00Z' },
      tracking: { token: 'tok' },
      evidenceSnapshotHash: SNAPSHOT_HASH,
      polygonCertifications: { contentHash: hash, send: '0x' + '2'.repeat(64) },
      readerUrl: `https://app.notificas.com/reader/${MESSAGE_ID}?k=tok`,
      waRequestSnapshot: {
        template: { name: 'notificacion', language: { code: 'es_AR' } },
        to: '+5492215462961',
      },
    },
    movements: [],
    attachments: [],
  });
  const raw = pdfText(await blob.arrayBuffer());
  assert.match(raw, /Cadena de vinculaci/);
  assert.match(raw, /WhatsApp/);
  assert.doesNotMatch(raw, /Contenido enviado por correo \(lector\)/);
  assert.match(raw, new RegExp(WAMID.replace(/\./g, '\\.')));
});

test('M: el contenido certificado no aparece duplicado como secciones jurídicas distintas', async () => {
  const hash = await computeContentHash(CONTENT);
  const blob = await generateCertificatePDF({
    messageId: MESSAGE_ID,
    issuedAt: new Date('2026-09-24T18:00:00.000Z'),
    evidenceSealed: true,
    mailData: {
      from: 'rem@example.com',
      recipientEmail: 'dest@example.com',
      recipientPhone: '+5492215462961',
      whatsappMessageId: WAMID,
      message: { subject: 'Intimación', contentText: CONTENT },
      delivery: { state: 'accepted', time: '2026-09-24T12:00:00Z' },
      tracking: { token: 'tok' },
      evidenceSnapshotHash: SNAPSHOT_HASH,
      polygonCertifications: { contentHash: hash, send: '0x' + '3'.repeat(64) },
      waRequestSnapshot: { template: { name: 'notificacion' }, to: '+5492215462961' },
    },
    movements: [],
    attachments: [],
  });
  const raw = pdfText(await blob.arrayBuffer());
  const titleCount = (raw.match(/Contenido certificado mostrado en el lector/g) || []).length;
  assert.equal(titleCount, 1);
  const body = certificatePlainBody({ contentText: CONTENT });
  const occurrences = raw.split(body).length - 1;
  assert.equal(occurrences, 1, 'el texto jurídico debe aparecer una sola vez');
});

test('tokenReference no expone el token completo', () => {
  const ref = tokenReference('super-secret-token-value');
  assert.equal(ref?.length, 16);
  assert.notEqual(ref, 'super-secret-token-value');
});

test('leyendas de certificado incluyen messageId y contentHash', () => {
  const hash = 'e'.repeat(64);
  assert.match(certifiedContentLegend(MESSAGE_ID, hash), new RegExp(MESSAGE_ID));
  assert.match(certifiedContentLegend(MESSAGE_ID, hash), new RegExp(hash));
  assert.match(whatsAppReaderLinkExplanation(MESSAGE_ID, hash), /Contenido certificado mostrado en el lector/);
});
