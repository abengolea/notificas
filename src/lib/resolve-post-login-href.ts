import type { User } from "firebase/auth";
import {
  EMPRESA_ONLY_LOGIN_MESSAGE,
  isConsumerAppPath,
  isEmpresaAppPath,
  isEmpresaOnlyUser,
} from "@/lib/user-account-kind";

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

export type PostLoginResolution =
  | { ok: true; href: string }
  | { ok: false; code: "empresa_only"; message: string; empresaHref: string };

/**
 * Login de particulares (`/dashboard`) no admite cuentas solo-empresa.
 * Login de empresas (`/empresa`) va al dashboard de esa org.
 */
export async function resolvePostLoginHref(
  user: User,
  options: { requested: string; defaultConsumerEntry?: boolean },
): Promise<PostLoginResolution> {
  const requested = options.requested;
  const path = requested.split("?")[0];
  const token = await user.getIdToken();
  const res = await fetch("/api/organizations", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    if (isConsumerAppPath(path) && options.defaultConsumerEntry) {
      return { ok: true, href: requested };
    }
    return { ok: true, href: requested };
  }

  const data = (await res.json()) as {
    organizations?: unknown;
    empresaOnly?: unknown;
    userTipo?: unknown;
  };
  const orgs = Array.isArray(data.organizations) ? data.organizations : [];
  const empresaHref = empresaHomeHrefFromOrgs(orgs) ?? "/empresa";
  const empresaOnly =
    data.empresaOnly === true || isEmpresaOnlyUser({ tipo: data.userTipo });

  if (empresaOnly && isConsumerAppPath(path)) {
    return {
      ok: false,
      code: "empresa_only",
      message: EMPRESA_ONLY_LOGIN_MESSAGE,
      empresaHref,
    };
  }

  if (isEmpresaAppPath(path)) {
    return { ok: true, href: empresaHomeHrefFromOrgs(orgs) ?? requested };
  }

  return { ok: true, href: requested };
}
