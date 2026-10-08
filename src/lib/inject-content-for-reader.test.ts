import { test } from "node:test";
import assert from "node:assert/strict";
import { injectContentForReader } from "./inject-content-for-reader";
import { sanitizeHtmlForReader } from "./sanitize-reader-html";
import { buildCampaignMailHtml } from "./campaign-email-html";
import { htmlFromFilledMetaBody, MAILBOX_READER_URL_SENTINEL } from "./campaign-mixed-message";

function readerView(html: string, content: string) {
  return sanitizeHtmlForReader(injectContentForReader(html, { message: { content } }));
}

test("CONTENT_PLACEHOLDER sigue inyectando el texto lacrado", () => {
  const html = `<div>sobre</div><!-- CONTENT_PLACEHOLDER --><div>pie</div>`;
  const out = injectContentForReader(html, { message: { content: "PRUEBA 5" } });
  assert.match(out, /PRUEBA 5/);
  assert.match(out, /sobre/);
  assert.match(out, /pie/);
});

test("el lector muestra la carta enviada, no el globo de Meta del Colegio", () => {
  const meta = htmlFromFilledMetaBody(
    `Estimado/a Adrian Bengolea,\n\nEl Colegio de Abogados de San Nicolás le envía una intimación oficial referida a su matrícula profesional.\n\nLea el documento completo en el siguiente enlace:\n${MAILBOX_READER_URL_SENTINEL}\n\nEsta es una comunicación formal del Colegio. La lectura queda registrada.`
  );
  const html = buildCampaignMailHtml({
    recipientEmail: "abengolea1@gmail.com",
    recipientName: "Adrian Bengolea",
    sender: "abengolea@hotmail.com",
    bodyHtml: meta,
    attachments: [],
    mode: "inline",
  });
  const letter = "PRUEBA SPRUEBA SPRUEBA 5";
  const out = readerView(html, letter);

  assert.match(out, /PRUEBA SPRUEBA SPRUEBA 5/);
  assert.equal(/intimación oficial/i.test(out), false);
  assert.equal(/El enlace se agregará/i.test(out), false);
  assert.equal(/Acceder a la notificación/i.test(out), false);
});

test("sin carta lacrada no borra el HTML del sobre", () => {
  const html = `<div class="message-content"><p>Solo plantilla</p></div>`;
  const out = injectContentForReader(html, { message: {} });
  assert.match(out, /Solo plantilla/);
});

test("globo Meta + carta oculta: el lector deja una sola copia de la carta lacrada", () => {
  const html = `
<!-- MAILBOX_META_START -->
<div class="message-content" data-reader-hide>
  <p>El Colegio le envía una intimación oficial.</p>
</div>
<!-- MAILBOX_META_END -->
<div class="message-content" data-email-hide>
  <p>PRUEBA NUEVA NUEVA</p>
</div>`;
  const out = readerView(html, "CARTA LACRADA");
  assert.match(out, /CARTA LACRADA/);
  assert.equal(/intimación oficial/i.test(out), false);
  assert.equal((out.match(/CARTA LACRADA/g) || []).length, 1);
});
