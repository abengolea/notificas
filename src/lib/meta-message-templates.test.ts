import { test } from "node:test";
import assert from "node:assert/strict";
import {
  extractTemplateBody,
  extractTemplateFooter,
  extractTemplateHeader,
  inferWaTemplateVariables,
  pickApprovedTemplate,
  summarizeApprovedTemplates,
  variablesForApprovedTemplate,
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

test("infiere nombre + url_lectura cuando el BODY pide un enlace", () => {
  const vars = inferWaTemplateVariables(
    "Estimado/a {{1}}, lea el documento en el siguiente enlace:\n{{2}}"
  );
  assert.deepEqual(vars, ["nombre", "url_lectura"]);
});

test("usa el mapeo conocido del Colegio y resume solo aprobadas", () => {
  const vars = variablesForApprovedTemplate("colegio_de_abogados_san_nicolas", "{{1}} {{2}} {{3}} {{4}} {{5}}");
  assert.deepEqual(vars, ["nombre", "tomo", "folio", "cuotas", "monto"]);
  const list = summarizeApprovedTemplates([
    { name: "alpha", language: "es_AR", status: "PENDING", components: [{ type: "BODY", text: "Hola {{1}}" }] },
    { name: "colegio_de_abogados_intimacion_matricula", language: "es_AR", status: "APPROVED", components: [{ type: "BODY", text: "Hola {{1}} {{2}}" }] },
    {
      name: "aviso",
      language: "es_AR",
      status: "APPROVED",
      components: [{ type: "BUTTONS", buttons: [{ type: "URL", text: "Ver" }] }, { type: "BODY", text: "X" }],
    },
  ]);
  assert.equal(list.length, 2);
  assert.equal(list[0].name, "aviso");
  assert.equal(list[0].urlButton, true);
  assert.equal(list[1].variableCount, 2);
});
