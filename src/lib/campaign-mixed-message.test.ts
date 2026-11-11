import { test } from "node:test";
import assert from "node:assert/strict";
import {
  effectiveMixedDeliveryMode,
  fillNumericPlaceholders,
  htmlFromFilledMetaBody,
  MAILBOX_READER_URL_SENTINEL,
  mixedModeEmailIsDirect,
  mixedModeWhatsAppUsesReader,
  mixedWhatsAppUsesReaderLink,
  normalizeMixedDeliveryMode,
  readerLetterFromMetaTemplate,
  renderCampaignMessageBody,
  renderMetaTemplateBody,
  usesMetaTemplateAsEmailBody,
} from "./campaign-mixed-message";
import { buildCampaignMailHtml, CAMPAIGN_MAILBOX_MODE, campaignBodyToHtmlFragment } from "./campaign-email-html";

const DEUDA =
  "Hola {{1}}, DNI {{2}}. Registramos una deuda vencida desde {{3}} por ${{4}} con {{5}} días de mora.";

test("mixtas con template custom no usan el sobre default de Notificas", () => {
  assert.equal(usesMetaTemplateAsEmailBody("ambos", "notificacion_deuda_180_dias"), true);
  assert.equal(usesMetaTemplateAsEmailBody("ambos", ""), false);
  assert.equal(usesMetaTemplateAsEmailBody("ambos", "notificaciones_notificas"), false);
  assert.equal(usesMetaTemplateAsEmailBody("whatsapp", "notificacion_deuda_180_dias"), false);
  assert.equal(usesMetaTemplateAsEmailBody("email", "notificacion_deuda_180_dias"), false);
  assert.equal(mixedWhatsAppUsesReaderLink(false), false);
  assert.equal(mixedWhatsAppUsesReaderLink(true), true);
});

test("renderiza el BODY de Meta con el mismo orden de {{N}} que WhatsApp", () => {
  const text = renderMetaTemplateBody({
    templateBody: DEUDA,
    variables: ["nombre", "dni", "fecha", "monto", "dias"],
    row: {
      nombre: "Adrian Bengolea",
      dni: "25715970",
      fecha: "14/02/26",
      monto: "130000",
      dias: "180",
    },
  });
  assert.equal(
    text,
    "Hola Adrian Bengolea, DNI 25715970. Registramos una deuda vencida desde 14/02/26 por $130000 con 180 días de mora."
  );
});

test("conserva 0 en cuotas (valor válido para Meta)", () => {
  const text = renderMetaTemplateBody({
    templateBody: "{{1}} cuota(s)",
    variables: ["cuotas"],
    row: { cuotas: "0" },
  });
  assert.equal(text, "0 cuota(s)");
});

test("la carta del lector copia el BODY de WhatsApp con {{nombre}} en vez de {{1}}", () => {
  const letter = readerLetterFromMetaTemplate({
    templateBody: DEUDA,
    variables: ["nombre", "dni", "fecha", "monto", "dias"],
  });
  assert.equal(
    letter,
    "Hola {{nombre}}, DNI {{dni}}. Registramos una deuda vencida desde {{fecha}} por ${{monto}} con {{dias}} días de mora."
  );
});

test("texto fijo del template queda escrito, no como variable", () => {
  const letter = readerLetterFromMetaTemplate({
    templateBody: "Hola {{1}}, ref {{2}}",
    variables: ["nombre", "=GOcuotas"],
  });
  assert.equal(letter, "Hola {{nombre}}, ref GOcuotas");
});

test("texto fijo (=) no sale del CSV", () => {
  const text = renderMetaTemplateBody({
    templateBody: "Hola {{1}}, ref {{2}}",
    variables: ["nombre", "=GOcuotas"],
    row: { nombre: "Ana" },
  });
  assert.equal(text, "Hola Ana, ref GOcuotas");
});

test("si hay carta, el lector usa esa y no el globo de Meta", () => {
  const text = renderCampaignMessageBody({
    canal: "ambos",
    waTemplateName: "colegio_de_abogados_intimacion_matricula",
    waTemplateBody: DEUDA,
    waTemplateVariables: ["nombre", "dni", "fecha", "monto", "dias"],
    cuerpo: "Intimación formal a {{nombre}} por matrícula.",
    row: {
      nombre: "Marcela Suárez",
      dni: "20123456",
      fecha: "01/03/26",
      monto: "50000",
      dias: "90",
    },
  });
  assert.equal(text, "Intimación formal a Marcela Suárez por matrícula.");
});

test("htmlFromFilledMetaBody deja el enlace del lector para que sendEmail lo complete", () => {
  const html = htmlFromFilledMetaBody(
    `Estimado/a Ana,\n\nLea el documento:\n${MAILBOX_READER_URL_SENTINEL}\n\nColegio.`
  );
  assert.match(html, /Estimado\/a Ana/);
  assert.match(html, /El enlace se agregará al enviar el mensaje/);
  assert.equal(html.includes(MAILBOX_READER_URL_SENTINEL), false);
});

test("sin carta, la mixta cae al BODY de Meta", () => {
  const text = renderCampaignMessageBody({
    canal: "ambos",
    waTemplateName: "notificacion_deuda_180_dias",
    waTemplateBody: DEUDA,
    waTemplateVariables: ["nombre", "dni", "fecha", "monto", "dias"],
    cuerpo: "",
    row: {
      nombre: "Marcela Suárez",
      dni: "20123456",
      fecha: "01/03/26",
      monto: "50000",
      dias: "90",
    },
  });
  assert.match(text, /Marcela Suárez/);
  assert.match(text, /50000/);
});

test("email-only sigue personalizando el cuerpo escrito", () => {
  const text = renderCampaignMessageBody({
    canal: "email",
    cuerpo: "Hola {{nombre}}, deuda {{monto}}",
    row: { nombre: "Ana", monto: "1000" },
  });
  assert.equal(text, "Hola Ana, deuda 1000");
});

test("fillNumericPlaceholders deja {{n}} si falta el valor", () => {
  assert.equal(fillNumericPlaceholders("A {{1}} B {{2}}", ["x"]), "A x B {{2}}");
});

test("campaña mixta: Gmail es sobre; el lector lacra la carta, no el globo", () => {
  const letter = renderCampaignMessageBody({
    canal: "ambos",
    waTemplateName: "notificacion_deuda_180_dias",
    waTemplateBody: DEUDA,
    waTemplateVariables: ["nombre", "dni", "fecha", "monto", "dias"],
    cuerpo: "Intimación formal a {{nombre}} por ${{monto}}.",
    row: { nombre: "Marcela Suárez", monto: "50000" },
  });
  assert.equal(letter, "Intimación formal a Marcela Suárez por $50000.");
  const html = buildCampaignMailHtml({
    recipientEmail: "a@b.com",
    recipientName: "Marcela Suárez",
    sender: "GOcuotas",
    bodyHtml: campaignBodyToHtmlFragment(letter),
    attachments: [],
    mode: CAMPAIGN_MAILBOX_MODE,
  });
  assert.equal(CAMPAIGN_MAILBOX_MODE, "teaser");
  assert.match(html, /data-email-hide/);
  assert.match(html, /le envió una notificación/);
  assert.match(html, /Intimación formal a Marcela Suárez/);
  assert.equal(/Registramos una deuda vencida/.test(html), false);
  assert.equal(/en este mismo correo/.test(html), false);
});

test("los tres modos de campaña mixta definen qué canal lleva el lector", () => {
  assert.equal(normalizeMixedDeliveryMode(undefined), "reader_both");
  assert.equal(normalizeMixedDeliveryMode("cualquier cosa"), "reader_both");
  assert.equal(mixedModeEmailIsDirect("reader_both"), false);
  assert.equal(mixedModeEmailIsDirect("same_text"), true);
  assert.equal(mixedModeEmailIsDirect("email_text_wa_reader"), true);
  assert.equal(mixedModeWhatsAppUsesReader("reader_both"), true);
  assert.equal(mixedModeWhatsAppUsesReader("same_text"), false);
  assert.equal(mixedModeWhatsAppUsesReader("email_text_wa_reader"), true);
  // Correo con lector + WhatsApp con la plantilla tal cual: el correo sigue siendo aviso y WhatsApp no abre el lector.
  assert.equal(mixedModeEmailIsDirect("email_reader_wa_template"), false);
  assert.equal(mixedModeWhatsAppUsesReader("email_reader_wa_template"), false);
  assert.equal(effectiveMixedDeliveryMode("email_reader_wa_template", false), "email_reader_wa_template");
  assert.equal(effectiveMixedDeliveryMode("email_reader_wa_template", true), "reader_both");
  // Con el sobre de Notificas WhatsApp siempre lleva el lector: "sin lector" pasa a la opción más cercana.
  assert.equal(effectiveMixedDeliveryMode("same_text", true), "email_text_wa_reader");
  assert.equal(effectiveMixedDeliveryMode("same_text", false), "same_text");
  assert.equal(effectiveMixedDeliveryMode("reader_both", true), "reader_both");
});

test("same_text: el correo lleva exactamente el texto de la plantilla de Meta, aunque haya carta", () => {
  const base = {
    canal: "ambos",
    waTemplateName: "notificacion_deuda_180_dias",
    waTemplateBody: DEUDA,
    waTemplateVariables: ["nombre", "dni", "fecha", "monto", "dias"],
    waUrlButton: false,
    cuerpo: "Carta editada a mano {{nombre}}",
    row: { nombre: "Ana", dni: "1", fecha: "01/01/26", monto: "10", dias: "5" },
  };
  const same = renderCampaignMessageBody({ ...base, mixedMode: "same_text" });
  assert.equal(same, "Hola Ana, DNI 1. Registramos una deuda vencida desde 01/01/26 por $10 con 5 días de mora.");
  assert.equal(renderCampaignMessageBody({ ...base, mixedMode: "email_text_wa_reader" }), "Carta editada a mano Ana");
  assert.equal(renderCampaignMessageBody({ ...base, mixedMode: "reader_both" }), "Carta editada a mano Ana");
});

test("correo directo: texto completo, sin botón ni enlace al lector", () => {
  const html = buildCampaignMailHtml({
    recipientEmail: "a@b.com",
    recipientName: "Ana",
    sender: "Empresa SA",
    bodyHtml: campaignBodyToHtmlFragment("Texto completo del mensaje"),
    attachments: [],
    mode: "direct",
  });
  assert.match(html, /Texto completo del mensaje/);
  assert.doesNotMatch(html, /data-email-hide/);
  assert.doesNotMatch(html, /href="#"/);
  assert.doesNotMatch(html, /class="btn"/);
  assert.doesNotMatch(html, /El enlace se agregará/);
  assert.doesNotMatch(html, /disponible en el enlace/);
});
