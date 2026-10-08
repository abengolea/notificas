import { test } from "node:test";
import assert from "node:assert/strict";
import { fieldsFromSavedWaTemplate, pickPreferredOrgWaTemplate } from "./wa-saved-template";
import type { SavedWaTemplate } from "./types";

function tpl(partial: Partial<SavedWaTemplate> & Pick<SavedWaTemplate, "id" | "templateName" | "label">): SavedWaTemplate {
  return {
    orgId: "org",
    templateLang: "es_AR",
    templateVariables: ["nombre", "url_lectura"],
    urlButton: false,
    ...partial,
  };
}

test("si no hay plantillas propias, no elige nada", () => {
  assert.equal(pickPreferredOrgWaTemplate([]), null);
  assert.equal(
    pickPreferredOrgWaTemplate([tpl({ id: "1", label: "Sobre", templateName: "notificaciones_notificas" })]),
    null
  );
});

test("elige la plantilla habilitada de la org y no el sobre de Notificas", () => {
  const picked = pickPreferredOrgWaTemplate([
    tpl({ id: "a", label: "Sobre", templateName: "notificaciones_notificas" }),
    tpl({ id: "b", label: "Intimación matrícula", templateName: "colegio_de_abogados_intimacion_matricula" }),
  ]);
  assert.equal(picked?.templateName, "colegio_de_abogados_intimacion_matricula");
});

test("fieldsFromSavedWaTemplate copia el mapeo o vuelve al sobre de Notificas", () => {
  const fallback = fieldsFromSavedWaTemplate(null);
  assert.equal(fallback.name, "notificaciones_notificas");
  assert.deepEqual(fallback.variables, ["nombre", "remitente", "url_lectura"]);
  const mapped = fieldsFromSavedWaTemplate(
    tpl({
      id: "b",
      label: "Intimación",
      templateName: "colegio_de_abogados_intimacion_matricula",
      templateVariables: ["nombre", "url_lectura"],
      urlButton: true,
      templateBody: "Hola {{1}}",
    })
  );
  assert.equal(mapped.name, "colegio_de_abogados_intimacion_matricula");
  assert.equal(mapped.urlButton, true);
  assert.equal(mapped.templateBody, "Hola {{1}}");
});
