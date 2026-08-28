import { test } from "node:test";
import assert from "node:assert/strict";
import {
  fillNumericPlaceholders,
  renderCampaignMessageBody,
  renderMetaTemplateBody,
  usesMetaTemplateAsEmailBody,
} from "./campaign-mixed-message";

const DEUDA =
  "Hola {{1}}, DNI {{2}}. Registramos una deuda vencida desde {{3}} por ${{4}} con {{5}} días de mora.";

test("mixtas con template custom usan el globo de Meta en el mail", () => {
  assert.equal(usesMetaTemplateAsEmailBody("ambos", "notificacion_deuda_180_dias"), true);
  assert.equal(usesMetaTemplateAsEmailBody("ambos", ""), false);
  assert.equal(usesMetaTemplateAsEmailBody("ambos", "notificaciones_notificas"), false);
  assert.equal(usesMetaTemplateAsEmailBody("whatsapp", "notificacion_deuda_180_dias"), false);
  assert.equal(usesMetaTemplateAsEmailBody("email", "notificacion_deuda_180_dias"), false);
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

test("texto fijo (=) no sale del CSV", () => {
  const text = renderMetaTemplateBody({
    templateBody: "Hola {{1}}, ref {{2}}",
    variables: ["nombre", "=GOcuotas"],
    row: { nombre: "Ana" },
  });
  assert.equal(text, "Hola Ana, ref GOcuotas");
});

test("campaña mixta usa waTemplateBody y no un cuerpo distinto", () => {
  const text = renderCampaignMessageBody({
    canal: "ambos",
    waTemplateName: "notificacion_deuda_180_dias",
    waTemplateBody: DEUDA,
    waTemplateVariables: ["nombre", "dni", "fecha", "monto", "dias"],
    cuerpo: "Este texto del correo NO debería salir",
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
  assert.equal(/Este texto del correo/.test(text), false);
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
