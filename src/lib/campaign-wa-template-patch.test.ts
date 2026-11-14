import { test } from "node:test";
import assert from "node:assert/strict";
import { whatsappTemplateCampaignPatch } from "./campaign-wa-template-patch";

const base = { waTemplateLang: "es_AR", waTemplateVariables: ["nombre", "campo_2"], waUrlButton: true };

test("elegir la plantilla de Notificas guarda su nombre explícito y sin variables propias", () => {
  const p = whatsappTemplateCampaignPatch({ ...base, waTemplateName: "notificaciones_notificas" });
  assert.equal(p.waTemplateName, "notificaciones_notificas");
  assert.deepEqual(p.waTemplateVariables, []);
  assert.equal(p.waUrlButton, false);
});

test("sin nombre sigue vacío (sin elegir)", () => {
  assert.equal(whatsappTemplateCampaignPatch({ ...base, waTemplateName: "" }).waTemplateName, "");
});

test("una plantilla propia conserva nombre y variables", () => {
  const p = whatsappTemplateCampaignPatch({ ...base, waTemplateName: "aviso_deuda" });
  assert.equal(p.waTemplateName, "aviso_deuda");
  assert.deepEqual(p.waTemplateVariables, ["nombre", "campo_2"]);
});
