import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCampaignMailHtml, CAMPAIGN_MAILBOX_MODE, campaignBodyToHtmlFragment, personalizeCampaignText, stripMailboxHiddenHtml } from './campaign-email-html';

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
  assert.equal(/Estimado\/a/.test(html), false);
  assert.equal(/mismo mensaje enviado por WhatsApp/.test(html), false);
  assert.equal(/Recibió una comunicación/.test(html), false);
  assert.equal(/data-email-hide/.test(html), false);
  assert.equal(/blockchain/i.test(html), false);
  assert.equal(/fehaciente/i.test(html), false);
  assert.equal(/Polygon/i.test(html), false);
  assert.equal(/Contenido del mensaje/i.test(html), false);
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

test('modo letter muestra la carta en el correo y no dice que es el globo de WhatsApp', () => {
  const html = buildCampaignMailHtml({
    recipientEmail: 'a@b.com',
    recipientName: 'Ana',
    sender: 'Colegio de Abogados de San Nicolás',
    bodyHtml: campaignBodyToHtmlFragment('Intimación por matrícula impaga.'),
    attachments: [],
    mode: 'letter',
  });
  assert.match(html, /Intimación por matrícula impaga/);
  assert.match(html, /mismo acceso que le enviamos por WhatsApp/);
  assert.equal(/data-email-hide/.test(html), false);
  assert.equal(/mismo mensaje enviado por WhatsApp/.test(html), false);
});

test('inline no duplica una carta distinta para el lector', () => {
  const html = buildCampaignMailHtml({
    recipientEmail: 'a@b.com',
    recipientName: 'Ana',
    sender: 'Colegio de Abogados de San Nicolás',
    bodyHtml: campaignBodyToHtmlFragment('El Colegio le envía una intimación.'),
    attachments: [],
    mode: 'inline',
  });
  assert.match(html, /El Colegio le envía una intimación/);
  assert.equal(/Contenido del mensaje/i.test(html), false);
  assert.equal(/MAILBOX_META_START/.test(html), false);
  assert.equal(/data-reader-hide/.test(html), false);
  assert.equal(/Carta extendida/.test(html), false);
});

test('modo teaser oculta el cuerpo (el lector lo muestra)', () => {
  const html = buildCampaignMailHtml({
    recipientEmail: 'a@b.com',
    recipientName: 'Ana',
    sender: 'GOcuotas',
    bodyHtml: campaignBodyToHtmlFragment('Secreto'),
    attachments: [],
    mode: CAMPAIGN_MAILBOX_MODE,
  });
  assert.equal(CAMPAIGN_MAILBOX_MODE, 'teaser');
  assert.match(html, /data-email-hide/);
  assert.match(html, /Secreto/);
  assert.match(html, /le envió una notificación/);
  assert.equal(/en este mismo correo/.test(html), false);
  assert.equal(/Nueva comunicacion para usted/.test(html), false);
  const mailbox = stripMailboxHiddenHtml(html);
  assert.equal(/Secreto/.test(mailbox), false);
  assert.match(mailbox, /le envió una notificación/);
  assert.match(mailbox, /Acceder a la notificación/);
  assert.match(mailbox, />GOcuotas</);
  assert.equal(/Si el boton no funciona/.test(mailbox), false);
  assert.equal(/abengolea1@hotmail/.test(mailbox), false);
});

test('el tipo elegido se refleja igual en etiqueta, frase, botón, título y aviso', () => {
  for (const [kind, noun, badge] of [
    ['notificacion', 'notificación', 'NOTIFICACIÓN'],
    ['comunicacion', 'comunicación', 'COMUNICACIÓN'],
    ['intimacion', 'intimación', 'INTIMACIÓN'],
  ] as const) {
    const html = buildCampaignMailHtml({
      recipientEmail: 'a@b.com',
      recipientName: 'Ana',
      sender: 'Colegio',
      bodyHtml: campaignBodyToHtmlFragment('Texto'),
      attachments: [],
      mode: CAMPAIGN_MAILBOX_MODE,
      kind,
    });
    assert.match(html, new RegExp(`<span class="badge">${badge}</span>`));
    assert.match(html, new RegExp(`le envió una ${noun}\.`));
    assert.match(html, new RegExp(`>Acceder a la ${noun}</a>`));
    assert.match(html, new RegExp(`<title>Nueva ${noun} digital</title>`));
    assert.match(html, new RegExp(`Importante:</strong> este correo contiene una ${noun} cuyo contenido`));
    assert.match(html, new RegExp(`impide que la ${noun} produzca los efectos`));
    // Nunca queda otro sustantivo mezclado (la incoherencia que había antes).
    for (const other of ['notificación', 'comunicación', 'intimación'].filter((n) => n !== noun)) {
      assert.equal(new RegExp(`una ${other}|la ${other}|${other.toUpperCase()}`).test(html), false, `${kind} menciona ${other}`);
    }
  }
});

test('sin tipo se usa notificación y el aviso queda en el sobre del correo', () => {
  const html = buildCampaignMailHtml({
    recipientEmail: 'a@b.com',
    recipientName: 'Ana',
    sender: 'Colegio',
    bodyHtml: '',
    attachments: [],
  });
  assert.match(html, /<span class="badge">NOTIFICACIÓN<\/span>/);
  assert.match(html, /class="muted notice-disclaimer"/);
  assert.equal(/El envío y la lectura quedan registrados\.\s*<\/p>/.test(html), false);
  assert.match(html, /El envío, el acceso y la lectura quedan registrados\./);
});

test('el pie no muestra el email del destinatario y enlaza a la web', () => {
  const html = buildCampaignMailHtml({
    recipientEmail: 'persona.privada@ejemplo.com',
    recipientName: 'Ana',
    sender: 'Colegio',
    bodyHtml: '',
    attachments: [],
  });
  assert.equal(html.includes('persona.privada@ejemplo.com'), false);
  assert.match(html, /<a href="https:\/\/notificas\.com\.ar" target="_blank" rel="noopener"[^>]*>Visitar nuestra web<\/a>/);
});
