import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildNotificationHumanSummary,
  deriveEmailEvidence,
  deriveWhatsAppEvidence,
  emailLegacyPixelDetected,
  emailReaderAccessDetected,
  emailResendSignalDetected,
  formatEvidenceStatus,
  whatsAppLinkClickedDetected,
  whatsAppMetaReadDetected,
} from './certificate-email-evidence';

test('reader_magic_open no debe contarse como pixel del correo', () => {
  const state = deriveEmailEvidence([
    { type: 'reader_magic_open', timestamp: '2026-09-24T18:47:00Z' },
  ]);
  assert.equal(emailLegacyPixelDetected(state), false);
  assert.equal(emailResendSignalDetected(state), false);
  assert.equal(emailReaderAccessDetected(state), true);
});

test('resend_opened_signal cuenta como señal técnica, no como pixel Notificas', () => {
  const state = deriveEmailEvidence([
    { type: 'resend_opened_signal', timestamp: '2026-09-24T18:47:00Z' },
  ]);
  assert.equal(emailResendSignalDetected(state), true);
  assert.equal(emailLegacyPixelDetected(state), false);
});

test('sin movimientos: todo no consta (tracking.opened no se usa aquí)', () => {
  const email = deriveEmailEvidence([]);
  assert.equal(formatEvidenceStatus(emailResendSignalDetected(email)), 'No consta');
  assert.equal(formatEvidenceStatus(emailLegacyPixelDetected(email)), 'No consta');
  assert.equal(formatEvidenceStatus(emailReaderAccessDetected(email)), 'No consta');
});

test('app_opened del remitente no cuenta como apertura del destinatario', () => {
  const email = deriveEmailEvidence([
    { type: 'app_opened', timestamp: '2026-09-24T18:47:00Z', viewerIsSender: true },
  ]);
  const summary = buildNotificationHumanSummary({
    hasWhatsApp: false,
    waDelivered: false,
    email,
    whatsapp: deriveWhatsAppEvidence([]),
    mailAccepted: true,
  });
  assert.match(summary, /correo aceptado/i);
  assert.doesNotMatch(summary, /aplicaci/i);
});

test('acceso desde enlace WA sin tilde Meta aparece en el resumen humano', () => {
  const whatsapp = deriveWhatsAppEvidence([
    { type: 'whatsapp_link_clicked', timestamp: '2026-09-25T16:13:15Z' },
  ]);
  const email = deriveEmailEvidence([
    { type: 'read_confirmed', timestamp: '2026-09-25T15:11:49Z' },
  ]);
  assert.equal(whatsAppMetaReadDetected(whatsapp), false);
  assert.equal(whatsAppLinkClickedDetected(whatsapp), true);
  const summary = buildNotificationHumanSummary({
    hasWhatsApp: true,
    waDelivered: true,
    email,
    whatsapp,
    mailAccepted: true,
  });
  assert.match(summary, /acceso desde el enlace del mensaje/i);
  assert.match(summary, /lectura confirmada en el lector certificado/i);
  assert.doesNotMatch(summary, /fehaciente/i);
  assert.doesNotMatch(summary, /no equivale/i);
});
