import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  deliveryFactsFromCampaignConfig,
  deliveryFactsFromMail,
  describeDelivery,
  type DeliveryFacts,
} from './campaign-delivery-facts';

const both = { hasEmail: true, hasWhatsApp: true };

test('correo directo + plantilla propia sin enlace = mismo texto, sin lector', () => {
  const f = deliveryFactsFromMail({ emailDirect: true, waTemplateName: 'aviso', waTemplateVariables: ['nombre'] }, both);
  assert.deepEqual(f, { email: 'text', whatsapp: 'template', source: 'sealed' });
});

test('correo con aviso + plantilla propia sin enlace (el caso de PRUEBA 8)', () => {
  const f = deliveryFactsFromMail(
    { waTemplateName: 'encabezado_aviso', waTemplateVariables: ['nombre', 'dni', 'fecha', 'monto', 'cuotas'] },
    both
  );
  assert.equal(f.email, 'reader_notice');
  assert.equal(f.whatsapp, 'template');
});

test('WhatsApp con botón URL o variable url_lectura lleva el lector', () => {
  assert.equal(deliveryFactsFromMail({ waTemplateName: 'x', waUrlButton: true }, both).whatsapp, 'reader_link');
  assert.equal(
    deliveryFactsFromMail({ waTemplateName: 'x', waTemplateVariables: ['nombre', 'url_lectura'] }, both).whatsapp,
    'reader_link'
  );
});

test('con el sobre de Notificas WhatsApp siempre lleva el lector', () => {
  assert.equal(deliveryFactsFromMail({}, both).whatsapp, 'reader_link');
  assert.equal(deliveryFactsFromMail({ waTemplateName: 'notificaciones_notificas' }, both).whatsapp, 'reader_link');
});

test('un canal que no se usó queda en null', () => {
  assert.equal(deliveryFactsFromMail({ waOnly: true }, { hasEmail: false, hasWhatsApp: true }).email, null);
  assert.equal(deliveryFactsFromMail({}, { hasEmail: true, hasWhatsApp: false }).whatsapp, null);
});

test('envíos anteriores: se deduce del modo de la campaña y queda marcado', () => {
  const mk = (mixedMode: string, waTemplateName = 'aviso') =>
    deliveryFactsFromCampaignConfig({ canal: 'ambos', mixedMode, waTemplateName });
  assert.deepEqual(mk('email_reader_wa_template'), { email: 'reader_notice', whatsapp: 'template', source: 'campaign_config' });
  assert.deepEqual(mk('same_text'), { email: 'text', whatsapp: 'template', source: 'campaign_config' });
  assert.deepEqual(mk('email_text_wa_reader'), { email: 'text', whatsapp: 'reader_link', source: 'campaign_config' });
  assert.deepEqual(mk('reader_both'), { email: 'reader_notice', whatsapp: 'reader_link', source: 'campaign_config' });
  // Con el sobre de Notificas WhatsApp no puede ir sin lector.
  assert.equal(mk('email_reader_wa_template', 'notificaciones_notificas')?.whatsapp, 'reader_link');
  assert.equal(deliveryFactsFromCampaignConfig({ canal: 'ambos', mixedMode: '' }), null);
  assert.equal(deliveryFactsFromCampaignConfig({ canal: 'email', mixedMode: 'same_text' }), null);
});

const EMAIL: Array<DeliveryFacts['email']> = ['text', 'reader_notice', null];
const WA: Array<DeliveryFacts['whatsapp']> = ['reader_link', 'template', null];

test('la redacción nunca afirma algo que el registro no dice (todas las combinaciones)', () => {
  for (const email of EMAIL) {
    for (const whatsapp of WA) {
      for (const shares of [true, false]) {
        const n = describeDelivery({ email, whatsapp, source: 'sealed' }, shares);
        const all = Object.values(n).filter(Boolean).join(' ');
        const tag = `email=${email} wa=${whatsapp} shares=${shares}`;
        // «mismo texto» solo si el correo llevó el texto en su cuerpo.
        if (email !== 'text') assert.doesNotMatch(all, /mismo texto|mismo cuerpo|común a correo/i, tag);
        // Con aviso + lector no se puede decir que el texto está en el cuerpo del correo.
        if (email === 'reader_notice') assert.doesNotMatch(all, /viajó en el cuerpo del correo|va en el cuerpo del correo/i, tag);
        // Solo se menciona el botón al lector si el correo fue un aviso.
        if (email !== 'reader_notice') assert.doesNotMatch(all, /Acceder a la notificación/, tag);
        // Solo se afirma «sin enlace al lector» si WhatsApp fue plantilla sin lector.
        if (whatsapp !== 'template') assert.doesNotMatch(all, /No lleva enlace al lector|sin enlace al lector/i, tag);
        if (whatsapp !== 'reader_link') assert.doesNotMatch(all, /con el enlace al lector/i, tag);
        assert.equal(Boolean(n.emailLine), email !== null, tag);
        assert.equal(Boolean(n.whatsappLine), whatsapp !== null, tag);
      }
    }
  }
});

test('sin registro de cómo viajó el correo no se afirma nada de eso', () => {
  const n = describeDelivery(null, true);
  assert.equal(n.emailLine, null);
  assert.equal(n.whatsappLine, null);
  assert.doesNotMatch(
    Object.values(n).filter(Boolean).join(' '),
    /mismo cuerpo|mismo texto|común a correo|Acceder a la notificación/
  );
  assert.match(n.textIntro, /no registra si el correo/);
});

test('un envío deducido de la configuración lo dice', () => {
  const n = describeDelivery({ email: 'reader_notice', whatsapp: 'template', source: 'campaign_config' }, true);
  assert.match(n.sourceNote || '', /anterior al registro/);
  assert.equal(describeDelivery({ email: 'text', whatsapp: 'template', source: 'sealed' }, true).sourceNote, null);
});
