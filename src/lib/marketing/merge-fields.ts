/**
 * Merge fields por destinatario para campañas comerciales del CRM.
 *
 * La interpolación ocurre al renderizar/enviar, nunca al guardar el borrador.
 * Para agregar una variable nueva: sumarla a MERGE_FIELD_DEFINITIONS y a
 * `buildMergeFields`. `applyMergeFields` no necesita cambios.
 */

export type MergeFieldDefinition = {
  key: string;
  aliases: readonly string[];
};

export const MERGE_FIELD_DEFINITIONS: readonly MergeFieldDefinition[] = [
  { key: "firstName", aliases: ["first_name"] },
  { key: "fullName", aliases: ["nombre", "name"] },
  { key: "companyName", aliases: ["empresa", "company"] },
  { key: "jobTitle", aliases: ["cargo", "title"] },
  { key: "countryName", aliases: ["pais", "country"] },
  { key: "email", aliases: [] },
];

const PLACEHOLDER_RE = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g;

export type MergeFields = Record<string, string>;

export type MergeFieldSource = {
  name?: string | null;
  firstName?: string | null;
  company?: string | null;
  companyName?: string | null;
  title?: string | null;
  countryName?: string | null;
  email?: string | null;
};

const DEFINITION_BY_ALIAS = (() => {
  const map = new Map<string, MergeFieldDefinition>();
  for (const def of MERGE_FIELD_DEFINITIONS) {
    map.set(def.key.toLowerCase(), def);
    for (const alias of def.aliases) map.set(alias.toLowerCase(), def);
  }
  return map;
})();

export function firstNameFromFullName(name: string): string {
  const trimmed = String(name || "").trim();
  if (!trimmed) return "";
  return trimmed.split(/\s+/)[0] || "";
}

export function escapeMergeHtml(value: string): string {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function hasUnresolvedMergePlaceholders(text: string): boolean {
  PLACEHOLDER_RE.lastIndex = 0;
  return PLACEHOLDER_RE.test(text);
}

/**
 * "Hola {{firstName}}," sin nombre debe quedar "Hola,", no "Hola ,".
 * Solo colapsa espacios ASCII delante de puntuación; no toca sangría HTML.
 */
export function collapseEmptyMergePunctuation(text: string): string {
  return text.replace(/[ \t]+([,.;:!?])/g, "$1");
}

function preferNonEmpty(existing: string | undefined, incoming: string): string {
  if (incoming) return incoming;
  return existing ?? incoming;
}

function indexMergeFields(fields: Record<string, string>): Record<string, string> {
  const index: Record<string, string> = {};
  for (const [key, raw] of Object.entries(fields)) {
    const value = raw ?? "";
    const lower = key.toLowerCase();
    index[lower] = preferNonEmpty(index[lower], value);
    const def = DEFINITION_BY_ALIAS.get(lower);
    if (!def) continue;
    index[def.key.toLowerCase()] = preferNonEmpty(index[def.key.toLowerCase()], value);
    for (const alias of def.aliases) {
      const aliasKey = alias.toLowerCase();
      index[aliasKey] = preferNonEmpty(index[aliasKey], value);
    }
  }
  if (!index.firstname) {
    const inferred = firstNameFromFullName(index.fullname || index.nombre || index.name || "");
    index.firstname = inferred;
    index.first_name = inferred;
  }
  return index;
}

export function buildMergeFields(source: MergeFieldSource = {}): MergeFields {
  const fullName = String(source.name || "").trim();
  const firstName = String(source.firstName || "").trim() || firstNameFromFullName(fullName);
  const companyName = String(source.companyName || source.company || "").trim();
  const jobTitle = String(source.title || "").trim();
  const countryName = String(source.countryName || "").trim();
  const email = String(source.email || "").trim();

  const canonical: Record<string, string> = {
    firstName,
    fullName,
    companyName,
    jobTitle,
    countryName,
    email,
  };

  const out: MergeFields = { ...canonical };
  for (const def of MERGE_FIELD_DEFINITIONS) {
    const value = canonical[def.key] || "";
    out[def.key] = value;
    for (const alias of def.aliases) out[alias] = value;
  }
  return out;
}

export function applyMergeFields(
  template: string,
  fields: MergeFields,
  options?: { escapeHtml?: boolean },
): string {
  const index = indexMergeFields(fields);
  const merged = String(template || "").replace(PLACEHOLDER_RE, (_full, key: string) => {
    const value = index[String(key).toLowerCase()] || "";
    return options?.escapeHtml ? escapeMergeHtml(value) : value;
  });
  return collapseEmptyMergePunctuation(merged);
}

export const PREVIEW_SAMPLE_CONTACT = {
  name: "César Pérez",
  company: "YPF S.A.",
  title: "Gerente de Operaciones",
  countryName: "Argentina",
  email: "contacto@empresa.com",
} as const;

export const PREVIEW_SAMPLE_CONTACT_WITHOUT_NAME = {
  name: "",
  company: "YPF S.A.",
  title: "",
  countryName: "Argentina",
  email: "contacto@empresa.com",
} as const;

export const MERGE_FIELD_HINT =
  "{{firstName}} {{fullName}} {{companyName}} {{jobTitle}} · también {{nombre}} {{empresa}} {{pais}} {{cargo}} {{email}}";
