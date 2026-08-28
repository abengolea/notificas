import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCampaignMailHtml, campaignBodyToHtmlFragment, personalizeCampaignText } from './campaign-email-html';

test('personalizeCampaignText cubre monto, fecha y días', () => {
  const out = personalizeCampaignText(
    'Hola {{nombre}}, deuda {{monto}} desde {{fecha}} ({{dias}} días)',
    { nombre: 'Ana', monto: '1000', fecha: '14/02/26', dias: '180' }
  );
  assert.equal(out, 'Hola Ana, deuda 1000 desde 14/02/26 (180 días)');
});

test('modo inline no marca el cuerpo para ocultarlo al enviar', () => {
  const html = buildCampaignMailHtml({
    recipientEmail: 'a@b.com',
    recipientName: 'Ana',
    sender: 'GOcuotas',
    bodyHtml: campaignBodyToHtmlFragment('Hola Ana, hay una deuda.'),
    attachments: [],
    mode: 'inline',
  });
  assert.match(html, /Hola Ana, hay una deuda/);
  assert.match(html, /mismo mensaje enviado por WhatsApp/);
  assert.equal(/data-email-hide/.test(html), false);
  assert.equal(/blockchain/i.test(html), false);
  assert.equal(/fehaciente/i.test(html), false);
  assert.equal(/Polygon/i.test(html), false);
});

test('modo inline usa el cuerpo como preheader de bandeja', () => {
  const html = buildCampaignMailHtml({
    recipientEmail: 'a@b.com',
    recipientName: 'Ana',
    sender: 'GOcuotas',
    bodyHtml: campaignBodyToHtmlFragment('Deuda de prueba 180 días'),
    attachments: [],
    mode: 'inline',
    previewText: 'Deuda de prueba 180 días',
  });
  assert.match(html, /Deuda de prueba 180 días/);
});

test('modo teaser oculta el cuerpo (el lector lo muestra)', () => {
  const html = buildCampaignMailHtml({
    recipientEmail: 'a@b.com',
    recipientName: 'Ana',
    sender: 'Notificas',
    bodyHtml: campaignBodyToHtmlFragment('Secreto'),
    attachments: [],
  });
  assert.match(html, /data-email-hide/);
  assert.match(html, /Secreto/);
});
