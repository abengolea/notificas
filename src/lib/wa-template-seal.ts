import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { sha256Hex } from "@/lib/merkle";

export type WhatsAppTemplateSeal = {
  hash: string;
  payload: string;
  templateName: string;
  templateLang: string;
  templateVariables: string[];
  urlButton: boolean;
  sealedAt: unknown;
};

/** Identidad del formulario WA de la campaña (igual para los 150 mil). */
export function buildWhatsAppTemplateSealPayload(input: {
  templateName?: string;
  templateLang?: string;
  templateVariables?: string[] | null;
  urlButton?: boolean;
}): string {
  const vars = (input.templateVariables || [])
    .map((v) => String(v || "").trim())
    .filter(Boolean)
    .join(",");
  return [
    "WA_TPL",
    "v1",
    String(input.templateName || "").trim(),
    String(input.templateLang || "es_AR").trim() || "es_AR",
    vars,
    input.urlButton ? "1" : "0",
  ].join("|");
}

export function recipientWhatsAppVars(
  variables: string[] | undefined,
  row: {
    nombre?: string;
    dni?: string;
    legajo?: string;
    dias?: string;
    email?: string;
    telefono?: string;
  }
): Record<string, string> {
  const keys = (variables && variables.length ? variables : ["nombre", "dni", "dias"]).filter(
    (k) => k !== "url_lectura" && k !== "boton_url"
  );
  const src: Record<string, string> = {
    nombre: row.nombre || "",
    dni: row.dni || "",
    legajo: row.legajo || "",
    dias: row.dias || "",
    email: row.email || "",
    telefono: row.telefono || "",
  };
  const out: Record<string, string> = {};
  for (const k of keys) {
    const v = (src[k] || "").trim();
    if (v) out[k] = v;
  }
  return out;
}

/**
 * Sella una vez el template de la campaña. No genera TX: la huella viaja
 * en cada hoja y en el sobre de 500.
 */
export async function sealCampaignWhatsAppTemplate(
  campaignId: string
): Promise<WhatsAppTemplateSeal | null> {
  const db = getAdminDb();
  const ref = db.collection("campaigns").doc(campaignId);
  const snap = await ref.get();
  if (!snap.exists) return null;
  const c = snap.data()!;
  const existing = c.waTemplateSeal as WhatsAppTemplateSeal | undefined;
  if (existing?.hash) return existing;

  const name = String(c.waTemplateName || "").trim();
  if (!name) return null;

  const payload = buildWhatsAppTemplateSealPayload({
    templateName: name,
    templateLang: String(c.waTemplateLang || "es_AR"),
    templateVariables: Array.isArray(c.waTemplateVariables) ? c.waTemplateVariables : [],
    urlButton: c.waUrlButton === true,
  });
  const hash = await sha256Hex(payload);
  const record: WhatsAppTemplateSeal = {
    hash,
    payload,
    templateName: name,
    templateLang: String(c.waTemplateLang || "es_AR"),
    templateVariables: Array.isArray(c.waTemplateVariables) ? c.waTemplateVariables : [],
    urlButton: c.waUrlButton === true,
    sealedAt: FieldValue.serverTimestamp(),
  };

  await db.runTransaction(async (t) => {
    const again = await t.get(ref);
    if (again.data()?.waTemplateSeal?.hash) return;
    t.update(ref, { waTemplateSeal: record });
  });

  const fresh = await ref.get();
  return (fresh.data()?.waTemplateSeal as WhatsAppTemplateSeal) || record;
}
