const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  fillPlaceholders,
  effectiveButtonUrl,
  buildWhatsAppTemplateEvidence,
} = require('./wa-template-snapshot');

const DEUDA_BODY =
  'Hola {{1}}, DNI {{2}}. Registramos una deuda vencida desde {{3}} por ${{4}} con {{5}} días de mora.';

const deudaTemplate = {
  id: 'tpl_deuda',
  name: 'notificacion_deuda_180_dias',
  language: 'es_AR',
  status: 'APPROVED',
  components: [{ type: 'BODY', text: DEUDA_BODY }],
};

const bodyParams = [
  { type: 'text', text: 'Adrian Bengolea' },
  { type: 'text', text: '25715970' },
  { type: 'text', text: '14/02/26' },
  { type: 'text', text: '130000' },
  { type: 'text', text: '180' },
];

test('TEST 1 — template sin botón: globo completo y sentButtons vacío', () => {
  const ev = buildWhatsAppTemplateEvidence({
    metaTemplate: deudaTemplate,
    bodyParameters: bodyParams,
    buttonParameters: null,
    requestIncludedUrlButton: false,
  });
  assert.equal(
    ev.renderedBody,
    'Hola Adrian Bengolea, DNI 25715970. Registramos una deuda vencida desde 14/02/26 por $130000 con 180 días de mora.'
  );
  assert.equal(ev.templateBodyMissing, false);
  assert.deepEqual(ev.sentButtons, []);
});

test('TEST 2 — botón URL dinámico al lector: texto Meta + URL = prefijo + parámetro del request', () => {
  const meta = {
    id: 'tpl_lector',
    components: [
      { type: 'BODY', text: 'Estimado {{1}}, abra el comprobante.' },
      {
        type: 'BUTTONS',
        buttons: [
          {
            type: 'URL',
            text: 'Ver notificación',
            url: 'https://notificas--notificas-f9953.us-central1.hosted.app{{1}}',
          },
        ],
      },
    ],
  };
  const suffix = '/linkRedirect?msg=abc&k=tok&src=whatsapp';
  const ev = buildWhatsAppTemplateEvidence({
    metaTemplate: meta,
    bodyParameters: [{ type: 'text', text: 'Adrian' }],
    buttonParameters: [{ type: 'text', text: suffix }],
    requestIncludedUrlButton: true,
  });
  assert.equal(ev.renderedBody, 'Estimado Adrian, abra el comprobante.');
  assert.equal(ev.sentButtons.length, 1);
  assert.equal(ev.sentButtons[0].text, 'Ver notificación');
  assert.equal(
    ev.sentButtons[0].url,
    `https://notificas--notificas-f9953.us-central1.hosted.app${suffix}`
  );
});

test('TEST 3 — botón a URL del cliente (estática en el template aprobado)', () => {
  const meta = {
    components: [
      { type: 'BODY', text: 'Hola {{1}}' },
      {
        type: 'BUTTONS',
        buttons: [{ type: 'URL', text: 'Regularizar deuda', url: 'https://cliente.com/pagar/xyz' }],
      },
    ],
  };
  const ev = buildWhatsAppTemplateEvidence({
    metaTemplate: meta,
    bodyParameters: [{ type: 'text', text: 'Adrian' }],
    buttonParameters: null,
    requestIncludedUrlButton: false,
  });
  assert.equal(ev.renderedBody, 'Hola Adrian');
  assert.equal(ev.sentButtons[0].text, 'Regularizar deuda');
  assert.equal(ev.sentButtons[0].url, 'https://cliente.com/pagar/xyz');
});

test('TEST 4 — sin template Meta: no inventa globo; readerUrl interno no genera botón', () => {
  const ev = buildWhatsAppTemplateEvidence({
    metaTemplate: null,
    fallbackBody: null,
    bodyParameters: bodyParams,
    buttonParameters: null,
    requestIncludedUrlButton: false,
  });
  assert.equal(ev.renderedBody, null);
  assert.equal(ev.templateBodyMissing, true);
  assert.deepEqual(ev.sentButtons, []);
});

test('sin prefijo de Meta no inventa URL aunque haya parámetro de botón', () => {
  assert.equal(effectiveButtonUrl('', '/linkRedirect?msg=x'), null);
  const ev = buildWhatsAppTemplateEvidence({
    metaTemplate: null,
    bodyParameters: [],
    buttonParameters: [{ type: 'text', text: '/linkRedirect?msg=x&k=secret' }],
    requestIncludedUrlButton: true,
  });
  assert.equal(ev.sentButtons[0].url, null);
  assert.equal(ev.sentButtons[0].urlParameter, '/linkRedirect?msg=x&k=secret');
});

test('fallback del template default Notificas si Graph no responde', () => {
  const ev = buildWhatsAppTemplateEvidence({
    metaTemplate: null,
    fallbackBody: 'Hola {{1}} de {{2}}',
    bodyParameters: [
      { type: 'text', text: 'Ana' },
      { type: 'text', text: 'Estudio' },
    ],
    buttonParameters: null,
    requestIncludedUrlButton: false,
  });
  assert.equal(ev.renderedBody, 'Hola Ana de Estudio');
  assert.equal(ev.templateBodyMissing, false);
});

test('fillPlaceholders deja {{n}} si falta el valor', () => {
  assert.equal(fillPlaceholders('A {{1}} B {{2}}', ['x']), 'A x B {{2}}');
});
