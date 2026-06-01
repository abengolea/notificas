import type { User } from "firebase/auth";

const EMPRESA_AVISO_PARAM = "aviso=modulo-empresas";

/**
 * Si el usuario entró por el login “general” (sin `?next=`) y pidió el dashboard,
 * pero tiene organizaciones en Firestore, lo enviamos al módulo empresas con aviso.
 */
export async function resolvePostLoginHref(
  user: User,
  options: { requested: string; defaultConsumerEntry: boolean },
): Promise<string> {
  // Siempre revisar org. B2B cuando el destino es el panel de particulares,
  // aunque venga `?next=/dashboard` (enlace guardado o "Acceso empresas" mal copiado).
  if (options.requested !== "/dashboard") return options.requested;

  const token = await user.getIdToken();
  const res = await fetch("/api/organizations", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return options.requested;

  const data = (await res.json()) as { organizations?: unknown };
  const orgs = Array.isArray(data.organizations) ? data.organizations : [];
  if (orgs.length > 0) return `/empresa?${EMPRESA_AVISO_PARAM}`;
  return options.requested;
}
