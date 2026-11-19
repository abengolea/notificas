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

const NUMERIC_PLACEHOLDER_RE = /\{\{\s*(\d+)\s*\}\}/g;

/**
 * {{1}}, {{2}}… son la sintaxis del template de Meta: la carta no sabe qué dato es cada uno y los deja a la vista.
 * En la carta las variables van con el nombre de la columna ({{nombre}}, {{monto}}).
 */
export function numericLetterPlaceholders(texts: Array<string | null | undefined>): number[] {
  const out: number[] = [];
  for (const text of texts) {
    for (const m of String(text || "").matchAll(NUMERIC_PLACEHOLDER_RE)) {
      const n = Number(m[1]);
      if (Number.isFinite(n) && !out.includes(n)) out.push(n);
    }
  }
  return out.sort((a, b) => a - b);
}

/** Palabras que rodean a {{n}} en la carta, para que quien arma el mensaje sepa qué dato es. */
export function contextAroundNumericPlaceholder(text: string, n: number, radius = 34): string {
  const m = new RegExp(String.raw`\{\{\s*${n}\s*\}\}`).exec(String(text || ""));
  if (!m) return "";
  const start = Math.max(0, m.index - radius);
  const end = Math.min(text.length, m.index + m[0].length + radius);
  const flat = (s: string) => s.replace(/\s+/g, " ");
  return `${start > 0 ? "…" : ""}${flat(text.slice(start, m.index))}[${n}]${flat(text.slice(m.index + m[0].length, end))}${end < text.length ? "…" : ""}`;
}

/** Nombre de columna válido para una variable de la carta, o "" si no se puede usar. */
export function normalizeLetterColumnName(raw: string): string {
  const k = String(raw || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[\s-]+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
  return /^[a-z][a-z0-9_]*$/.test(k) ? k : "";
}

/**
 * Reemplaza cada {{N}} de la carta según `mapping`: un nombre de columna pasa a {{columna}}; un valor que empieza con
 * «=» es un texto fijo y se escribe tal cual. Los {{N}} sin dato asignado quedan como están.
 */
export function replaceNumericLetterPlaceholders(text: string, mapping: Record<number, string>): string {
  return String(text || "").replace(NUMERIC_PLACEHOLDER_RE, (full, raw: string) => {
    const value = mapping[Number(raw)];
    if (value === undefined || value === null) return full;
    if (value.startsWith("=")) return value.slice(1).trim() ? value.slice(1) : full;
    const col = normalizeLetterColumnName(value);
    return col ? `{{${col}}}` : full;
  });
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
/** Aviso para quien arma la carta cuando quedaron {{1}}, {{2}}… sin asignar. "" si no hay ninguno. */
export function describeNumericLetterPlaceholders(numbers: number[]): string {
  if (!numbers.length) return "";
  const list = numbers.map((n) => `{{${n}}}`).join(", ");
  return `La carta tiene ${list}, que no se completan solos: en la carta las variables llevan el nombre de la columna (por ejemplo {{nombre}}, {{monto}}). Indicá qué dato va en cada una en «Variables de la carta».`;
}

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
