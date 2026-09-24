import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  deriveEmailEvidence,
  emailChannelHumanSummary,
  emailLegacyPixelDetected,
  emailReaderAccessDetected,
  emailResendSignalDetected,
  formatEvidenceStatus,
} from './certificate-email-evidence';

test('reader_magic_open no debe contarse como pixel del correo', () => {
  const state = deriveEmailEvidence([
    { type: 'reader_magic_open', timestamp: '2026-09-24T18:47:00Z' },
  ]);
  assert.equal(emailLegacyPixelDetected(state), false);
  assert.equal(emailResendSignalDetected(state), false);
  assert.equal(emailReaderAccessDetected(state), true);
  assert.equal(emailChannelHumanSummary(state), 'Accedido en el lector certificado');
});

test('resend_opened_signal cuenta como señal técnica, no como pixel Notificas', () => {
  const state = deriveEmailEvidence([
    { type: 'resend_opened_signal', timestamp: '2026-09-24T18:47:00Z' },
  ]);
  assert.equal(emailResendSignalDetected(state), true);
  assert.equal(emailLegacyPixelDetected(state), false);
  assert.match(emailChannelHumanSummary(state), /Señal técnica de apertura/);
});

test('sin movimientos: todo no consta (tracking.opened no se usa aquí)', () => {
  const state = deriveEmailEvidence([]);
  assert.equal(formatEvidenceStatus(emailResendSignalDetected(state)), 'No consta');
  assert.equal(formatEvidenceStatus(emailLegacyPixelDetected(state)), 'No consta');
  assert.equal(formatEvidenceStatus(emailReaderAccessDetected(state)), 'No consta');
  assert.equal(emailChannelHumanSummary(state), 'Sin señales de apertura a la emisión');
});

test('app_opened del remitente no cuenta como apertura del destinatario', () => {
  const state = deriveEmailEvidence([
    { type: 'app_opened', timestamp: '2026-09-24T18:47:00Z', viewerIsSender: true },
  ]);
  assert.equal(emailChannelHumanSummary(state), 'Sin señales de apertura a la emisión');
});
