const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  htmlToPlainText,
  buildCampaignPlainText,
  buildCampaignListHeaders,
  appendCampaignUnsubscribeFooter,
  listUnsubscribeUrl,
} = require('./campaign-mail-deliverability');

test('htmlToPlainText incluye el cuerpo visible y omite preheader oculto', () => {
  const html = `<html><body>
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">preheader spam</div>
    <p>Hola Ana, hay una deuda de 180 días.</p>
    <a href="https://app.example/reader/abc?k=tok">Acceder a la notificación</a>
  </body></html>`;
  const text = htmlToPlainText(html);
  assert.match(text, /Hola Ana, hay una deuda/);
  assert.match(text, /https:\/\/app\.example\/reader\/abc\?k=tok/);
  assert.equal(/preheader spam/.test(text), false);
});

test('buildCampaignPlainText no usa jerga de blockchain ni fehaciente', () => {
  const text = buildCampaignPlainText({
    html: '<p>Texto del template de Meta.</p>',
    readerUrl: 'https://app.example/reader/x?k=y',
    recipientEmail: 'a@hotmail.com',
    year: 2026,
  });
  assert.match(text, /Texto del template de Meta/);
  assert.match(text, /a@hotmail\.com/);
  assert.equal(/blockchain/i.test(text), false);
  assert.equal(/fehaciente/i.test(text), false);
  assert.equal(/Confirmar lectura/i.test(text), false);
});

test('List-Unsubscribe usa HTTPS y One-Click', () => {
  const headers = buildCampaignListHeaders({
    appHostingUrl: 'https://notificas.com.ar/',
    docId: 'mailAbc',
    trackingToken: 'tok_1',
    campaignId: 'camp-99!',
  });
  assert.equal(
    headers['List-Unsubscribe'],
    '<https://notificas.com.ar/api/mail/list-unsubscribe?m=mailAbc&k=tok_1>'
  );
  assert.equal(headers['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click');
  assert.match(headers['Feedback-ID'], /^camp-99:notificas:campaign:mail$/);
});

test('appendCampaignUnsubscribeFooter no duplica y deja la URL cruda', () => {
  const url = listUnsubscribeUrl('https://app.example', 'id1', 'k1');
  const html = `<td class="footer"><div class="muted">2026 Notificas.com</div></td></tr></table></td></tr></table></body></html>`;
  const once = appendCampaignUnsubscribeFooter(html, url);
  const twice = appendCampaignUnsubscribeFooter(once, url);
  assert.equal(once, twice);
  assert.match(once, /puede darse de baja/);
  assert.match(once, /href="https:\/\/app\.example\/api\/mail\/list-unsubscribe\?m=id1&amp;k=k1"/);
});
