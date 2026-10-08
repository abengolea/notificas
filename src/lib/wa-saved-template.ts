import {
  isWaTemplateVarEmpty,
  usesNotificasDefaultTemplate,
  WA_DEFAULT_TEMPLATE_NAME,
  WA_TEMPLATE_DEFAULT_VARS,
  WA_TEMPLATE_MAX_VARS,
} from "@/lib/wa-template-fields";
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
    templateBody: String(data.templateBody || "").trim() || undefined,
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
  if (vars.length > WA_TEMPLATE_MAX_VARS) return `Máximo ${WA_TEMPLATE_MAX_VARS} variables.`;
  if (vars.some((v) => isWaTemplateVarEmpty(v))) return "Hay una variable vacía. Completala o usá texto fijo.";
  return null;
}

export function pickPreferredOrgWaTemplate(list: SavedWaTemplate[]): SavedWaTemplate | null {
  const real = list.filter((t) => !usesNotificasDefaultTemplate(t.templateName));
  if (!real.length) return null;
  return real.slice().sort((a, b) => a.label.localeCompare(b.label, "es"))[0] || null;
}

export function fieldsFromSavedWaTemplate(tpl: SavedWaTemplate | null): {
  name: string;
  lang: string;
  variables: string[];
  urlButton: boolean;
  templateBody: string;
} {
  if (!tpl) {
    return {
      name: WA_DEFAULT_TEMPLATE_NAME,
      lang: "es_AR",
      variables: [...WA_TEMPLATE_DEFAULT_VARS],
      urlButton: false,
      templateBody: "",
    };
  }
  return {
    name: tpl.templateName,
    lang: tpl.templateLang || "es_AR",
    variables: Array.isArray(tpl.templateVariables) ? [...tpl.templateVariables] : [],
    urlButton: tpl.urlButton === true,
    templateBody: tpl.templateBody || "",
  };
}
