import { effectiveMixedDeliveryMode } from "@/lib/campaign-mixed-message";
import { presentRecipientValue, recipientValueText } from "@/lib/parse-campaign-csv";
import { usesNotificasDefaultTemplate } from "@/lib/wa-template-fields";

/**
 * Variables de la carta (asunto y cuerpo) de una campaña: {{nombre}}, {{fecha}}, {{anios_adeudados}}, …
 * Cualquier columna del CSV puede usarse como variable. Las de contacto y las que el sistema completa solo
 * no se piden como columna extra.
 */

const PLACEHOLDER_RE = /\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g;

/** Siempre están en el encabezado del CSV de una campaña con correo (columnas base). */
const BASE_CSV_FIELDS = new Set(["nombre", "email", "dni"]);

/** Las completa el sistema, nunca vienen del CSV. */
const SYSTEM_FIELDS = new Set(["remitente", "empresa", "url_lectura", "boton_url"]);

/** Campos de la fila que ya tienen columna propia en el mensaje guardado. No van en `recipientExtras`. */
const CORE_ROW_KEYS = new Set([
  "email",
  "nombre",
  "artrecipientid",
  "dni",
  "legajo",
  "telefono",
  "dias",
  "fecha",
  "monto",
  "cuotas",
  "adjunto",
]);

const EXTRA_KEY_RE = /^[a-z][a-z0-9_]{0,39}$/;
export const RECIPIENT_EXTRAS_MAX_KEYS = 40;
export const RECIPIENT_EXTRA_VALUE_MAX = 2000;

function normalizeKey(raw: string): string {
  const k = String(raw || "").trim().toLowerCase();
  return k === "dias_atraso" ? "dias" : k;
}

/** Nombres de variable usados en los textos, en minúscula y sin repetir. Ignora {{1}}, {{2}} (son de Meta). */
export function letterPlaceholders(texts: Array<string | null | undefined>): string[] {
  const out: string[] = [];
  for (const text of texts) {
    for (const m of String(text || "").matchAll(PLACEHOLDER_RE)) {
      const key = normalizeKey(m[1]);
      if (key && !out.includes(key)) out.push(key);
    }
  }
  return out;
}

/** Columnas del CSV que pide la carta (sin las de contacto ni las que completa el sistema). */
export function csvColumnsFromLetterText(texts: Array<string | null | undefined>): string[] {
  return letterPlaceholders(texts).filter((k) => !BASE_CSV_FIELDS.has(k) && !SYSTEM_FIELDS.has(k));
}

/** Textos de una campaña guardada que se personalizan con los datos de cada destinatario (asunto y carta). */
export function campaignLetterTexts(campaign: {
  canal?: unknown;
  mixedMode?: unknown;
  waTemplateName?: unknown;
  asunto?: unknown;
  cuerpo?: unknown;
}): string[] {
  const canal = String(campaign.canal || "email");
  if (canal === "whatsapp") return [];
  const mixedMode =
    canal === "ambos"
      ? effectiveMixedDeliveryMode(campaign.mixedMode, usesNotificasDefaultTemplate(String(campaign.waTemplateName || "")))
      : undefined;
  // Con «mismo texto en ambos canales» el correo lleva el cuerpo de la plantilla de Meta, no la carta.
  const letter = mixedMode === "same_text" ? "" : String(campaign.cuerpo || "");
  return [String(campaign.asunto || ""), letter];
}

/** Une listas de columnas sin repetir, respetando el orden. */
export function mergeCsvColumns(...lists: Array<string[] | undefined | null>): string[] {
  const out: string[] = [];
  for (const list of lists) {
    for (const raw of list || []) {
      const c = normalizeKey(raw);
      if (c && !out.includes(c)) out.push(c);
    }
  }
  return out;
}

/**
 * Datos de la fila que no tienen columna propia en el mensaje guardado (área y cualquier columna propia del CSV).
 * Se guardan juntos en `recipientExtras` para que la carta pueda usarlos.
 */
export function recipientExtraFields(row: object | null | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!row) return out;
  for (const [rawKey, value] of Object.entries(row as Record<string, unknown>)) {
    const key = rawKey.trim().toLowerCase();
    if (CORE_ROW_KEYS.has(key) || !EXTRA_KEY_RE.test(key) || key.endsWith("__")) continue;
    if (Object.keys(out).length >= RECIPIENT_EXTRAS_MAX_KEYS) break;
    if (!presentRecipientValue(value)) continue;
    out[key] = recipientValueText(value).slice(0, RECIPIENT_EXTRA_VALUE_MAX);
  }
  return out;
}

/** Lee `recipientExtras` de un mensaje guardado; devuelve solo texto. */
export function readRecipientExtras(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return recipientExtraFields(raw as Record<string, unknown>);
}

type RowLike = Record<string, unknown>;

function rowValue(row: RowLike, key: string): string {
  if (key === "dias") return recipientValueText(row.dias) || recipientValueText(row.dias_atraso);
  return recipientValueText(row[key]);
}

export type LetterVariableProblem = {
  field: string;
  /** Cantidad de destinatarios sin dato para esa variable. */
  affected: number;
  /** Nombres de ejemplo (hasta 3). */
  sample: string[];
};

export type LetterVariablesCheck = {
  ok: boolean;
  problems: LetterVariableProblem[];
  message: string;
};

export function describeLetterVariableProblems(problems: LetterVariableProblem[]): string {
  return problems
    .map((p) => {
      const who = p.sample.length ? ` (por ejemplo: ${p.sample.join(", ")})` : "";
      return `A ${p.affected.toLocaleString("es-AR")} destinatario${p.affected === 1 ? "" : "s"} le falta «${p.field}», que se usa en la carta como {{${p.field}}}${who}.`;
    })
    .join(" ");
}

/**
 * La carta se lacra con lo que se reemplace en ella. Un {{dato}} sin valor saldría vacío o con las llaves en un
 * documento legal: se frena antes de enviar. `rows` son las filas del CSV (con sus columnas propias).
 */
export function checkLetterVariables(opts: {
  texts: Array<string | null | undefined>;
  rows: object[];
}): LetterVariablesCheck {
  const fields = letterPlaceholders(opts.texts).filter((k) => !SYSTEM_FIELDS.has(k));
  const rows = opts.rows as RowLike[];
  const problems: LetterVariableProblem[] = [];
  for (const field of fields) {
    const bad = rows.filter((r) => !rowValue(r, field));
    if (!bad.length) continue;
    problems.push({
      field,
      affected: bad.length,
      sample: bad
        .slice(0, 3)
        .map((r) => recipientValueText(r.nombre) || recipientValueText(r.email) || recipientValueText(r.dni) || "sin nombre"),
    });
  }
  return { ok: problems.length === 0, problems, message: describeLetterVariableProblems(problems) };
}
