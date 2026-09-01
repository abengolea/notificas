import type { User } from "firebase/auth";

function orgIdFromUnknown(row: unknown): string | null {
  if (!row || typeof row !== "object" || !("id" in row)) return null;
  const id = (row as { id: unknown }).id;
  return typeof id === "string" && id.trim() ? id : null;
}

/** Destino del módulo empresas: dashboard si hay una sola org; selector si hay varias. */
export function empresaHomeHrefFromOrgs(orgs: unknown[]): string | null {
  const ids = orgs.map(orgIdFromUnknown).filter((id): id is string => !!id);
  if (ids.length === 1) return `/empresa/${ids[0]}/dashboard`;
  if (ids.length > 1) return "/empresa";
  return null;
}

function shouldResolveEmpresaHome(requested: string): boolean {
  if (requested === "/dashboard") return true;
  const path = requested.split("?")[0];
  return path === "/empresa" || path === "/empresa/";
}

/**
 * Si el usuario pidió el panel de particulares o la raíz de empresas,
 * y tiene organizaciones en Firestore, lo enviamos al dashboard de esa org
 * (o al selector si tiene más de una).
 */
export async function resolvePostLoginHref(
  user: User,
  options: { requested: string; defaultConsumerEntry: boolean },
): Promise<string> {
  if (!shouldResolveEmpresaHome(options.requested)) return options.requested;

  const token = await user.getIdToken();
  const res = await fetch("/api/organizations", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return options.requested;

  const data = (await res.json()) as { organizations?: unknown };
  const orgs = Array.isArray(data.organizations) ? data.organizations : [];
  return empresaHomeHrefFromOrgs(orgs) ?? options.requested;
}
