import { isWaTemplateVarEmpty, usesNotificasDefaultTemplate, WA_TEMPLATE_MAX_VARS } from "@/lib/wa-template-fields";
import type { SavedWaTemplate } from "@/lib/types";

export const WA_SAVED_TEMPLATES_MAX = 40;

export function lastUsedWaTemplateKey(orgId: string): string {
  return `notificas.waSavedTemplate.${orgId}`;
}

export function mapSavedWaTemplate(id: string, data: Record<string, unknown>): SavedWaTemplate {
  return {
    id,
    orgId: String(data.orgId || ""),
    label: String(data.label || data.templateName || "Template"),
    templateName: String(data.templateName || "").trim(),
    templateLang: String(data.templateLang || "es_AR").trim() || "es_AR",
    templateVariables: Array.isArray(data.templateVariables)
      ? data.templateVariables.map((v) => String(v || "").trim()).filter(Boolean)
      : [],
    urlButton: data.urlButton === true,
  };
}

export function assertSavableWaMapping(input: {
  templateName: string;
  templateVariables: string[];
}): string | null {
  if (usesNotificasDefaultTemplate(input.templateName)) {
    return "El template por defecto de Notificas ya está en el sistema; guardá uno con nombre de Meta.";
  }
  const vars = input.templateVariables.map((v) => v.trim());
  if (!vars.length) return "El template no tiene variables mapeadas.";
  if (vars.length > WA_TEMPLATE_MAX_VARS) return `Máximo ${WA_TEMPLATE_MAX_VARS} variables.`;
  if (vars.some((v) => isWaTemplateVarEmpty(v))) return "Hay una variable vacía. Completala o usá texto fijo.";
  return null;
}
