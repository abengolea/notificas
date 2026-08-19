import { test } from "node:test";
import assert from "node:assert/strict";
import { canonicalWhatsAppBody, describeWhatsAppSentContent } from "./whatsapp-evidence";

const readerUrl =
  "https://notificas--notificas-f9953.us-central1.hosted.app/linkRedirect?msg=abc&k=secret&src=whatsapp";

test("TEST 1 — WhatsApp sin botón: globo completo y sin linkRedirect", () => {
  const d = describeWhatsAppSentContent(
    {
      templateName: "notificacion_deuda_180_dias",
      templateLang: "es_AR",
      parameters: [
        { text: "Adrian Bengolea" },
        { text: "25715970" },
        { text: "14/02/26" },
        { text: "130000" },
        { text: "180" },
      ],
      renderedBody:
        "Hola Adrian Bengolea, DNI 25715970. Registramos una deuda vencida desde 14/02/26 por $130000 con 180 días de mora.",
      readerUrl,
      buttons: null,
      sentButtons: [],
    },
    ["nombre", "dni", "fecha", "monto", "dias"]
  );
  assert.ok(d);
  assert.match(d!.renderedBody || "", /Adrian Bengolea/);
  assert.equal(d!.buttons.length, 0);
  assert.equal(JSON.stringify(d).includes("linkRedirect"), false);
  assert.equal(JSON.stringify(d).includes(readerUrl), false);
});

test("TEST 2 — botón real al lector", () => {
  const dest =
    "https://notificas--notificas-f9953.us-central1.hosted.app/linkRedirect?msg=abc&k=tok&src=whatsapp";
  const d = describeWhatsAppSentContent({
    templateName: "aviso",
    templateLang: "es_AR",
    parameters: [{ text: "Adrian" }],
    renderedBody: "Estimado Adrian, abra el comprobante.",
    readerUrl,
    sentButtons: [
      {
        text: "Ver notificación",
        url: dest,
        urlParameter: "/linkRedirect?msg=abc&k=tok&src=whatsapp",
      },
    ],
  });
  assert.equal(d!.buttons[0].text, "Ver notificación");
  assert.equal(d!.buttons[0].url, dest);
});

test("TEST 3 — botón a URL del cliente", () => {
  const d = describeWhatsAppSentContent({
    templateName: "deuda",
    parameters: [{ text: "Adrian" }],
    renderedBody: "Hola Adrian",
    readerUrl,
    sentButtons: [{ text: "Regularizar deuda", url: "https://cliente.com/pagar/xyz", urlParameter: null }],
  });
  assert.equal(d!.buttons[0].url, "https://cliente.com/pagar/xyz");
  assert.equal(d!.buttons[0].text, "Regularizar deuda");
});

test("TEST 4 — readerUrl interno no enviado no aparece", () => {
  const d = describeWhatsAppSentContent({
    templateName: "notificacion_deuda_180_dias",
    parameters: [{ text: "A" }],
    renderedBody: "Hola A",
    readerUrl,
    buttons: null,
    sentButtons: [],
  });
  assert.equal(d!.buttons.length, 0);
  assert.equal(JSON.stringify(d).includes("linkRedirect"), false);
});

test("hash v1 histórico no incluye renderedBody y sí readerUrl", () => {
  const s = canonicalWhatsAppBody({
    type: "template",
    to: "54911",
    templateName: "notificacion_deuda_180_dias",
    templateLang: "es_AR",
    parameters: [{ text: "Ana" }],
    readerUrl,
  });
  assert.match(s, /^WA_BODY\|v1\|/);
  assert.match(s, /linkRedirect/);
  assert.equal(s.includes("Hola Ana"), false);
});

test("hash v2 lacrado incluye el globo y no el readerUrl interno", () => {
  const globo = "Hola Ana, DNI 1. Mora 180 días.";
  const s = canonicalWhatsAppBody({
    type: "template",
    to: "54911",
    templateName: "notificacion_deuda_180_dias",
    templateLang: "es_AR",
    templateHash: "abc",
    parameters: [{ text: "Ana" }],
    renderedBody: globo,
    readerUrl,
    sentButtons: [],
  });
  assert.match(s, /^WA_BODY\|v2\|/);
  assert.equal(s.includes(globo), true);
  assert.equal(s.includes("linkRedirect"), false);
});

test("acta: {{5}} cuotas 1 y globo con 1 cuota(s)", () => {
  const globo =
    "correspondiente a 1 cuota(s) vencida(s) e impaga(s)";
  const d = describeWhatsAppSentContent(
    {
      templateName: "notificacion_deuda_180_dias",
      templateLang: "es_AR",
      parameters: [
        { text: "Adrian Bengolea" },
        { text: "25715970" },
        { text: "14/02/26" },
        { text: "130000" },
        { text: "1" },
      ],
      renderedBody: `Hola Adrian Bengolea. ${globo}`,
      sentButtons: [],
    },
    ["nombre", "dni", "fecha", "monto", "cuotas"]
  );
  assert.ok(d);
  assert.equal(d!.variables[4].n, 5);
  assert.equal(d!.variables[4].field, "cuotas");
  assert.equal(d!.variables[4].value, "1");
  assert.match(d!.renderedBody || "", /correspondiente a 1 cuota\(s\) vencida\(s\) e impaga\(s\)/);
});
