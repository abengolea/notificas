import { createHash, randomUUID } from "crypto";
import { getMarketingWorkspaceId } from "../workspace";

/** ID interno estable. No usar nombre, email, dominio ni país como foreign key. */
export function newMarketingEntityId(): string {
  return randomUUID();
}

export function marketingListMembershipId(listId: string, contactId: string, workspaceId?: string): string {
  const ws = workspaceId || getMarketingWorkspaceId();
  return createHash("sha256").update(`mbr:${ws}:${listId}:${contactId}`).digest("hex").slice(0, 40);
}

export type MarketingCatalogKind = "country" | "industry" | "use_case" | "tag";

/** Slug estable de catálogo. No es el nombre visible. */
export const MARKETING_CATALOG_KEY_PATTERN = /^[a-z][a-z0-9_]{1,78}$/;

export function isMarketingCatalogKey(value: string): boolean {
  return MARKETING_CATALOG_KEY_PATTERN.test(value.trim());
}

/**
 * ID de documento Firestore para catálogos seed.
 * Determinista por workspace+kind+key: no es UUID aleatorio y no choca entre workspaces.
 * La identidad lógica que se guarda en FKs de empresa (`industryIds`, `useCaseIds`, `tagIds`) es el `key`.
 */
export function marketingCatalogId(workspaceId: string, kind: MarketingCatalogKind, key: string): string {
  const normalized = kind === "country" ? key.trim().toUpperCase() : key.trim();
  return createHash("sha256").update(`cat:${workspaceId}:${kind}:${normalized}`).digest("hex").slice(0, 40);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DOMAIN_RE = /^[a-z0-9.-]+\.[a-z]{2,}$/;
const ISO_COUNTRY_RE = /^[A-Z]{2}$/;

/**
 * Heurística de defensa: un FK no debería ser un email, un dominio ni un ISO de país suelto.
 * El id de contacto v1 (hash de email) es un id sintético válido.
 */
export function looksLikeNaturalKey(value: string): boolean {
  const v = value.trim();
  if (!v) return false;
  if (EMAIL_RE.test(v.toLowerCase())) return true;
  if (DOMAIN_RE.test(v.toLowerCase()) && v.includes(".")) return true;
  if (ISO_COUNTRY_RE.test(v.toUpperCase()) && v.length === 2) return true;
  return false;
}
