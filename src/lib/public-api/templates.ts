import { getAdminDb } from "@/lib/firebase-admin";
import { unprocessable } from "@/lib/public-api/errors";
import { usesNotificasDefaultTemplate, WA_DEFAULT_TEMPLATE_NAME } from "@/lib/wa-template-fields";
import { mapSavedWaTemplate } from "@/lib/wa-saved-template";

export type ResolvedTemplate = {
  templateName: string;
  templateLang: string;
  templateVariables: string[];
  urlButton: boolean;
  useDefault: boolean;
};

/** Variables que Notificas completa al enviar; no deben exigirse al agente. */
export const AUTO_FILLED_TEMPLATE_VARS = new Set(["remitente", "url_lectura", "url_constancia"]);

export async function resolveOrgTemplate(
  orgId: string,
  template: string | undefined,
  channel: "whatsapp" | "email"
): Promise<ResolvedTemplate> {
  const name = (template || "").trim();
  if (!name || usesNotificasDefaultTemplate(name) || name === WA_DEFAULT_TEMPLATE_NAME) {
    return {
      templateName: WA_DEFAULT_TEMPLATE_NAME,
      templateLang: "es_AR",
      templateVariables: ["nombre", "remitente", "url_lectura"],
      urlButton: false,
      useDefault: true,
    };
  }

  const db = getAdminDb();
  const snap = await db.collection("wa_templates").where("orgId", "==", orgId).get();
  const match = snap.docs
    .map((d) => mapSavedWaTemplate(d.id, d.data() as Record<string, unknown>))
    .find(
      (t) =>
        t.id === name ||
        t.templateName.toLowerCase() === name.toLowerCase() ||
        t.label.toLowerCase() === name.toLowerCase()
    );
  if (!match) {
    if (channel === "email") {
      return {
        templateName: name,
        templateLang: "es_AR",
        templateVariables: [],
        urlButton: false,
        useDefault: true,
      };
    }
    throw unprocessable(
      "unknown_template",
      "The template is not available for this account. Save it first in the WhatsApp templates of the organization.",
      "template"
    );
  }
  return {
    templateName: match.templateName,
    templateLang: match.templateLang,
    templateVariables: match.templateVariables,
    urlButton: match.urlButton,
    useDefault: false,
  };
}

export function missingTemplateVariables(
  required: string[],
  provided: Record<string, string>
): string[] {
  const missing: string[] = [];
  for (const name of required) {
    const key = name.trim();
    if (!key || AUTO_FILLED_TEMPLATE_VARS.has(key)) continue;
    const value = provided[key];
    if (value == null || String(value).trim() === "") missing.push(key);
  }
  return missing;
}
