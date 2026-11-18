import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkWaTemplateShape, describeBodyVariableMismatch, templateHasDynamicUrlButton } from './wa-template-shape';
import { resolveWaUrlButton } from './campaign-mixed-message';
import { whatsappTemplateCampaignPatch } from './campaign-wa-template-patch';

const BODY3 = 'Estimado/a {{1}},\n\n{{2}} le envía una comunicación formal.\n\nIngrese aquí:\n\n{{3}}\n\nEl acceso queda registrado.';

function tpl(over: Record<string, unknown> = {}) {
  return {
    name: 'comunicacion_formal',
    language: 'es_AR',
    status: 'APPROVED',
    components: [{ type: 'BODY', text: BODY3 }, { type: 'FOOTER', text: 'Notificas.com.ar' }],
    ...over,
  };
}

test('el caso del error #132000: link en el cuerpo pero la campaña lo trata como botón', () => {
  // Meta pide 3 parámetros y la campaña, con el botón prendido, manda 2 (saca url_lectura del cuerpo).
  const check = checkWaTemplateShape({
    template: tpl(),
    variables: ['nombre', 'remitente', 'url_lectura'],
    urlButton: true,
  });
  assert.equal(check.ok, false);
  assert.match(check.message, /tiene 3 variables y la campaña manda 2/);
  assert.match(check.message, /Desactivá el botón de enlace/);
});

test('coincide: tres variables en el cuerpo y sin botón', () => {
  const check = checkWaTemplateShape({
    template: tpl(),
    variables: ['nombre', 'remitente', 'url_lectura'],
    urlButton: false,
  });
  assert.equal(check.ok, true);
  assert.equal(check.message, '');
});

test('cantidad distinta de variables sin botón: pide definir la que falta', () => {
  const check = checkWaTemplateShape({ template: tpl(), variables: ['nombre', 'legajo'], urlButton: false });
  assert.equal(check.ok, false);
  assert.match(check.message, /tiene 3 variables y la campaña manda 2 \(\{\{1\}\}→nombre, \{\{2\}\}→legajo\)/);
  assert.match(check.message, /Falta definir qué dato va en \{\{3\}\}/);
});

test('el caso real: template con 3 variables y la campaña mapea solo nombre y legajo', () => {
  const body =
    'Hola {{1}}. Le informamos que se encuentra disponible una notificación judicial en el expediente N.º {{2}}, que tramita ante {{3}}.';
  const msg = describeBodyVariableMismatch({ body, variables: ['nombre', 'legajo'], urlButton: false, templateName: 'notificacion_judicial' });
  assert.match(msg, /tiene 3 variables y la campaña manda 2/);
  assert.match(msg, /\{\{3\}\}/);
  assert.equal(describeBodyVariableMismatch({ body, variables: ['nombre', 'legajo', '=Juzgado Civil N.º 1'], urlButton: false }), '');
  assert.match(describeBodyVariableMismatch({ body, variables: ['a', 'b', 'c', 'd'], urlButton: false }), /Sobran variables/);
});

test('botón con enlace variable: la campaña tiene que activarlo y no mandar el link en el cuerpo', () => {
  const withButton = tpl({
    components: [
      { type: 'BODY', text: 'Hola {{1}}, {{2}} te escribe.' },
      { type: 'BUTTONS', buttons: [{ type: 'URL', text: 'Abrir', url: 'https://notificas.com.ar{{1}}' }] },
    ],
  });
  assert.equal(templateHasDynamicUrlButton(withButton.components), true);
  assert.equal(
    checkWaTemplateShape({ template: withButton, variables: ['nombre', 'remitente', 'url_lectura'], urlButton: true }).ok,
    true
  );
  const off = checkWaTemplateShape({ template: withButton, variables: ['nombre', 'remitente'], urlButton: false });
  assert.equal(off.ok, false);
  assert.match(off.message, /botón con enlace variable y la campaña no lo activa/);
});

test('botón de URL fija no recibe parámetros', () => {
  const fixed = tpl({
    components: [
      { type: 'BODY', text: BODY3 },
      { type: 'BUTTONS', buttons: [{ type: 'URL', text: 'Web', url: 'https://notificas.com.ar' }] },
    ],
  });
  assert.equal(templateHasDynamicUrlButton(fixed.components), false);
  const check = checkWaTemplateShape({ template: fixed, variables: ['nombre', 'remitente', 'url_lectura'], urlButton: true });
  assert.equal(check.ok, false);
  assert.match(check.message, /no tiene un botón con enlace variable/);
});

test('template no aprobado o con variables en el encabezado se frena', () => {
  const pending = checkWaTemplateShape({
    template: tpl({ status: 'PENDING' }),
    variables: ['nombre', 'remitente', 'url_lectura'],
    urlButton: false,
  });
  assert.equal(pending.ok, false);
  assert.match(pending.message, /«PENDING»/);

  const header = checkWaTemplateShape({
    template: tpl({ components: [{ type: 'HEADER', format: 'TEXT', text: 'Aviso {{1}}' }, { type: 'BODY', text: BODY3 }] }),
    variables: ['nombre', 'remitente', 'url_lectura'],
    urlButton: false,
  });
  assert.equal(header.ok, false);
  assert.match(header.message, /encabezado/);
});

test('texto fijo cuenta como variable del cuerpo', () => {
  const check = checkWaTemplateShape({
    template: tpl(),
    variables: ['nombre', '=Colegio de Abogados', 'url_lectura'],
    urlButton: false,
  });
  assert.equal(check.ok, true);
});

test('el modo mixto solo apaga el botón, nunca lo prende', () => {
  // Antes: reader_both prendía el botón aunque el link fuera una variable del cuerpo.
  assert.equal(resolveWaUrlButton({ urlButton: false, mixedMode: 'reader_both', usesDefaultTemplate: false }), false);
  assert.equal(resolveWaUrlButton({ urlButton: true, mixedMode: 'reader_both', usesDefaultTemplate: false }), true);
  assert.equal(resolveWaUrlButton({ urlButton: true, mixedMode: 'same_text', usesDefaultTemplate: false }), false);
  assert.equal(resolveWaUrlButton({ urlButton: true, mixedMode: 'email_reader_wa_template', usesDefaultTemplate: false }), false);
  assert.equal(resolveWaUrlButton({ urlButton: true, mixedMode: undefined, usesDefaultTemplate: false }), true);
  assert.equal(resolveWaUrlButton({ urlButton: true, mixedMode: 'reader_both', usesDefaultTemplate: true }), false);
});

test('guardar el template de una mixta con link en el cuerpo no prende el botón', () => {
  const patch = whatsappTemplateCampaignPatch({
    waTemplateName: 'comunicacion_formal',
    waTemplateLang: 'es_AR',
    waTemplateVariables: ['nombre', 'remitente', 'url_lectura'],
    waUrlButton: false,
    mixedMode: 'reader_both',
  });
  assert.equal(patch.waUrlButton, false);
});
