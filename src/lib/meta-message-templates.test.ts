import { test } from "node:test";
import assert from "node:assert/strict";
import {
  extractTemplateBody,
  extractTemplateFooter,
  extractTemplateHeader,
  pickApprovedTemplate,
} from "./meta-message-templates";

const deuda = {
  name: "notificacion_deuda_180_dias",
  language: "es_AR",
  status: "APPROVED",
  components: [
    { type: "HEADER", format: "TEXT", text: "Aviso de mora" },
    {
      type: "BODY",
      text: "Hola {{1}}, DNI {{2}}. Registramos una deuda vencida desde {{3}}.",
    },
    { type: "FOOTER", text: "GOcuotas" },
  ],
};

test("elige el idioma pedido entre templates aprobados", () => {
  const picked = pickApprovedTemplate(
    [
      { ...deuda, language: "es", status: "APPROVED" },
      deuda,
    ],
    "es_AR"
  );
  assert.equal(picked?.language, "es_AR");
});

test("extrae BODY / header / footer del template de Meta", () => {
  assert.match(extractTemplateBody(deuda), /Hola \{\{1\}\}/);
  assert.equal(extractTemplateHeader(deuda), "Aviso de mora");
  assert.equal(extractTemplateFooter(deuda), "GOcuotas");
});

test("no toma HEADER de imagen como texto", () => {
  assert.equal(
    extractTemplateHeader({
      components: [{ type: "HEADER", format: "IMAGE" }],
    }),
    ""
  );
});
