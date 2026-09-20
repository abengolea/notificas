import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CAMPAIGN_EMAIL_COLORS,
  CAMPAIGN_EMAIL_MARKER,
  OILFIELD_USE_CASES,
  VACA_MUERTA_OILFIELD_CONTENT,
  buildCampaignEmailSnapshot,
  campaignEmailToText,
  escapeEmailText,
  persistCampaignEmail,
  renderCampaignEmail,
} from "./campaign-email";
import { assembleMarketingHtml, MARKETING_LOGO_WORDMARK_URL } from "./html";

test("la plantilla institucional usa el mismo HTML para preview y envío", () => {
  const preview = renderCampaignEmail({
    ...VACA_MUERTA_OILFIELD_CONTENT,
    unsubscribeUrl: "https://notificas.com.ar/api/marketing/u/preview",
  });
  assert.match(preview.html, new RegExp(CAMPAIGN_EMAIL_MARKER));
  assert.match(preview.html, /<!DOCTYPE html>/);
  assert.match(preview.html, new RegExp(CAMPAIGN_EMAIL_COLORS.page.replace("#", "#")));
  assert.match(preview.html, /#1B75E8/);
  assert.match(preview.html, /#0C1929/);
  assert.match(preview.html, new RegExp(MARKETING_LOGO_WORDMARK_URL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.equal((preview.html.match(/notificas-wordmark\.png/g) || []).length, 1);
  assert.match(preview.html, /Coordinar una demostración/);
  assert.match(preview.html, /www\.notificas\.com/);
  assert.doesNotMatch(preview.html, /www\.notificas\.com\.ar/);
  assert.match(preview.html, /Darse de baja/);
  assert.doesNotMatch(preview.html, /<script/i);
  assert.doesNotMatch(preview.html, /<form/i);
  for (const row of OILFIELD_USE_CASES) {
    assert.match(preview.html, new RegExp(row.body.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(preview.text, /Recibos y documentación laboral/);
  assert.match(preview.text, /Coordinar una demostración/);
});

test("el contenido dinámico se escapa", () => {
  const { html } = renderCampaignEmail({
    title: `Titulo <img src=x onerror=alert(1)>`,
    introduction: `Hola <b>x</b>`,
    paragraphs: [`texto & más`],
    benefits: [{ body: `caso <script>x</script>` }],
    callToActionLabel: `Click <em>ya</em>`,
    callToActionUrl: `https://notificas.com.ar/?q="`,
  });
  assert.match(html, /&lt;img src=x/);
  assert.doesNotMatch(html, /<img src=x onerror/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /&amp; más/);
});

test("assemble no cambia el diseño al agregar tracking", () => {
  const snapshot = buildCampaignEmailSnapshot(VACA_MUERTA_OILFIELD_CONTENT);
  const preview = assembleMarketingHtml({
    bodyHtml: snapshot.htmlBody,
    emailContent: snapshot.emailContent,
    sendId: "send1",
    contactId: "contact1",
    fields: { nombre: "Adrián", empresa: "YPF", pais: "Argentina", cargo: "", email: "a@x.com" },
    trackLinks: false,
    injectPixel: false,
  });
  const sent = assembleMarketingHtml({
    bodyHtml: snapshot.htmlBody,
    emailContent: snapshot.emailContent,
    sendId: "send1",
    contactId: "contact1",
    fields: { nombre: "Adrián", empresa: "YPF", pais: "Argentina", cargo: "", email: "a@x.com" },
    trackLinks: true,
    injectPixel: true,
  });
  assert.match(preview.html, /#F4F8FD/);
  assert.match(sent.html, /#F4F8FD/);
  assert.match(sent.html, /\/api\/marketing\/o\//);
  assert.match(sent.html, /\/api\/marketing\/u\//);
  assert.equal(preview.html.includes("notificas-wordmark.png"), true);
  assert.equal(sent.html.includes("notificas-wordmark.png"), true);
  assert.match(campaignEmailToText(snapshot.emailContent), /Notificas S\.R\.L\./);
  assert.equal(escapeEmailText("<x>"), "&lt;x&gt;");
});

test("el HTML legado de p/ul entra en la plantilla institucional", () => {
  const legacy = [
    "<p>Hola,</p>",
    "<p>Las empresas de selección administran documentación.</p>",
    "<p>Puede utilizarse para:</p>",
    "<ul><li>recibos y documentación laboral;</li><li>altas y procesos de incorporación;</li></ul>",
    "<p>Nos gustaría coordinar una breve demostración.</p>",
    "<p>Saludos,</p>",
    "<p><strong>Adrián Bengolea</strong><br>Gerente<br>Notificas S.R.L.</p>",
  ].join("");
  const snapshot = persistCampaignEmail({
    htmlBody: legacy,
    subject: "Documentación laboral trazable para personal distribuido",
    name: "Vaca Muerta | RR.HH. empleo y capacitación | Primera aproximación",
  });
  assert.match(snapshot.htmlBody, new RegExp(CAMPAIGN_EMAIL_MARKER));
  assert.match(snapshot.htmlBody, /#F4F8FD/);
  assert.match(snapshot.htmlBody, /notificas-wordmark\.png/);
  assert.match(snapshot.htmlBody, /Las empresas de selección administran documentación/);
  assert.match(snapshot.htmlBody, /recibos y documentación laboral/i);
  assert.match(snapshot.htmlBody, /Coordinar una demostración/);
  assert.doesNotMatch(snapshot.htmlBody, /Saludos,/);
  const assembled = assembleMarketingHtml({
    bodyHtml: snapshot.htmlBody,
    textBody: snapshot.textBody,
    sendId: "send1",
    contactId: "contact1",
    fields: { nombre: "Adrián", empresa: "su empresa", pais: "Argentina", cargo: "", email: "a@x.com" },
    trackLinks: false,
    injectPixel: false,
  });
  assert.match(assembled.html, /#F4F8FD/);
  assert.match(assembled.html, /notificas-wordmark\.png/);
});

test("un snapshot congelado no se vuelve a renderizar", () => {
  const snapshot = buildCampaignEmailSnapshot(VACA_MUERTA_OILFIELD_CONTENT);
  const frozen = snapshot.htmlBody.replaceAll(
    "Comunicaciones trazables para personal y contratistas",
    "TITULO CONGELADO",
  );
  const assembled = assembleMarketingHtml({
    bodyHtml: frozen,
    emailContent: snapshot.emailContent,
    textBody: snapshot.textBody,
    sendId: "send1",
    contactId: "contact1",
    fields: { nombre: "Adrián", empresa: "YPF", pais: "Argentina", cargo: "", email: "a@x.com" },
    trackLinks: false,
    injectPixel: false,
  });
  assert.match(assembled.html, /TITULO CONGELADO/);
  assert.doesNotMatch(assembled.html, /Comunicaciones trazables para personal y contratistas/);
});
