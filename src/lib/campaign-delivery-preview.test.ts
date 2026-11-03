import { test } from "node:test";
import assert from "node:assert/strict";
import { buildCampaignDeliveryPreview } from "./campaign-delivery-preview";
import { stripMailboxHiddenHtml } from "./campaign-email-html";

const LETTER = `Estimado/a Adrian Bengolea,

GOcuotas le notifica que registra una deuda pendiente.

DNI: 25715970
Monto: 130000
Fecha: 14/02/26
Días de mora:`;

test("stripMailboxHiddenHtml saca el cuerpo que Gmail no debe mostrar", () => {
  const html = `<p>aviso</p><div class="message-content" data-email-hide><p>SECRETO</p></div><p>boton</p>`;
  const out = stripMailboxHiddenHtml(html);
  assert.match(out, /aviso/);
  assert.match(out, /boton/);
  assert.equal(/SECRETO/.test(out), false);
  assert.equal(/data-email-hide/.test(out), false);
});

test("la previa de Gmail no lleva la carta; el lector sí", () => {
  const preview = buildCampaignDeliveryPreview({
    canal: "ambos",
    sender: "abengolea1@gmail.com",
    row: {
      nombre: "Adrian Bengolea",
      email: "abengolea1@gmail.com",
      dni: "25715970",
      fecha: "14/02/26",
      monto: "130000",
    },
    cuerpo: LETTER,
    waTemplateName: "notificacion_deuda_180_dias",
    waTemplateBody:
      "Hola {{1}}, deuda {{2}} vencida el {{3}} por ${{4}} en {{5}} cuota(s).",
    waTemplateVariables: ["nombre", "dni", "fecha", "monto", "cuotas"],
  });

  assert.equal(/GOcuotas le notifica/.test(preview.mailboxHtml), false);
  assert.equal(/DNI: 25715970/.test(preview.mailboxHtml), false);
  assert.match(preview.mailboxHtml, /Le recomendamos abrir el mensaje/);
  assert.match(preview.mailboxHtml, /Acceder a la notificación/);
  assert.equal(/data-email-hide/.test(preview.mailboxHtml), false);

  assert.match(preview.readerHtml, /GOcuotas le notifica/);
  assert.match(preview.readerHtml, /DNI: 25715970/);
  assert.equal(/Le recomendamos abrir el mensaje/.test(preview.readerHtml), false);
  assert.equal(/Acceder a la notificación/.test(preview.readerHtml), false);

  assert.match(preview.waText, /Hola Adrian Bengolea/);
  assert.match(preview.waText, /deuda 25715970/);
});
