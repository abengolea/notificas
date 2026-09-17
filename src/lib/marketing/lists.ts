import { countryName, isMarketingCountryCode } from "./countries";
import { isSendableStage } from "./stages";

export const COUNTRY_LIST_PREFIX = "country:";

export type RecipientSource =
  | { kind: "list"; listId: string }
  | { kind: "country"; country: string }
  | { kind: "none" };

export type RecipientRow = {
  id: string;
  email: string;
  name: string;
  company: string;
  title: string;
  country: string;
  stage: string;
  lastSentAt: string | null;
  listIds: string[];
  eligible: boolean;
  skipReason: string | null;
};

export function countryListKey(country: string): string {
  const code = (country || "all").trim();
  if (!code || code.toLowerCase() === "all") return `${COUNTRY_LIST_PREFIX}all`;
  return `${COUNTRY_LIST_PREFIX}${code.toUpperCase()}`;
}

export function parseRecipientSource(raw: string | null | undefined): RecipientSource {
  const id = (raw || "").trim();
  if (!id) return { kind: "none" };
  if (id.startsWith(COUNTRY_LIST_PREFIX)) {
    const code = id.slice(COUNTRY_LIST_PREFIX.length).trim();
    if (!code || code.toLowerCase() === "all") return { kind: "country", country: "all" };
    return { kind: "country", country: code.toUpperCase() };
  }
  return { kind: "list", listId: id };
}

export function skipReasonForStage(stage: string | null | undefined): string | null {
  if (stage === "unsubscribed") return "Dio de baja";
  if (stage === "bounced") return "Rebotó";
  if (stage === "not_interested") return "No interesa";
  return null;
}

export function contactMatchesSource(
  contact: { country?: unknown; listIds?: unknown },
  source: RecipientSource,
): boolean {
  if (source.kind === "none") return false;
  if (source.kind === "country") {
    if (source.country === "all") return true;
    return String(contact.country || "").toUpperCase() === source.country;
  }
  const ids = Array.isArray(contact.listIds) ? contact.listIds.map(String) : [];
  return ids.includes(source.listId);
}

export function toRecipientRow(contact: {
  id: string;
  email?: unknown;
  name?: unknown;
  company?: unknown;
  title?: unknown;
  country?: unknown;
  stage?: unknown;
  lastSentAt?: unknown;
  listIds?: unknown;
}): RecipientRow {
  const stage = String(contact.stage || "new");
  const skipReason = skipReasonForStage(stage);
  return {
    id: contact.id,
    email: String(contact.email || ""),
    name: String(contact.name || ""),
    company: String(contact.company || ""),
    title: String(contact.title || ""),
    country: String(contact.country || ""),
    stage,
    lastSentAt: typeof contact.lastSentAt === "string" ? contact.lastSentAt : null,
    listIds: Array.isArray(contact.listIds) ? contact.listIds.map(String) : [],
    eligible: isSendableStage(stage),
    skipReason,
  };
}

export function virtualCountryListName(country: string): string {
  if (!country || country === "all") return "Todos los contactos";
  if (isMarketingCountryCode(country)) return `${countryName(country)} (todos los contactos)`;
  return `${country} (todos los contactos)`;
}

export function normalizeListName(value: string): string {
  return value.trim().replace(/\s+/g, " ").slice(0, 80);
}

export function listNameKey(value: string): string {
  return normalizeListName(value).toLowerCase();
}

export function campaignRecipientSource(camp: { listId?: unknown; country?: unknown }): RecipientSource {
  const parsed = parseRecipientSource(typeof camp.listId === "string" ? camp.listId : "");
  if (parsed.kind !== "none") return parsed;
  const country = String(camp.country || "").trim();
  if (!country) return { kind: "none" };
  return { kind: "country", country: country.toLowerCase() === "all" ? "all" : country.toUpperCase() };
}

/** Solo listas nominadas: no arrastra todos los contactos de un país. */
export function namedRecipientSource(camp: { listId?: unknown; country?: unknown }): RecipientSource {
  const parsed = parseRecipientSource(typeof camp.listId === "string" ? camp.listId : "");
  return parsed.kind === "list" ? parsed : { kind: "none" };
}

export function decorateRecipient(row: RecipientRow, includeStages: Set<string> | null): RecipientRow {
  if (row.skipReason) return { ...row, eligible: false };
  if (includeStages && includeStages.size > 0 && !includeStages.has(row.stage)) {
    return { ...row, eligible: false, skipReason: "Fuera de las etapas elegidas" };
  }
  return { ...row, eligible: true, skipReason: null };
}

export function includeStageSet(stages: unknown): Set<string> | null {
  if (!Array.isArray(stages) || stages.length === 0) return null;
  return new Set(stages.map(String).filter(Boolean));
}
