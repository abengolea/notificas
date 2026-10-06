export const EMPRESA_ONLY_LOGIN_MESSAGE =
  "Esta cuenta no es de particulares. Es una cuenta de empresa: ingresá por el acceso empresas.";

export function isEmpresaOnlyUser(data: Record<string, unknown> | null | undefined): boolean {
  if (!data) return false;
  if (String(data.tipo || "").trim().toLowerCase() === "empresa") return true;
  if (data.createdByAdminOrg === true) return true;
  if (data.createdByOrgAdmin != null && String(data.createdByOrgAdmin).trim()) return true;
  return false;
}

export function isConsumerAppPath(pathname: string): boolean {
  const path = String(pathname || "").split("?")[0];
  return path === "/dashboard" || path.startsWith("/dashboard/");
}

export function isEmpresaAppPath(pathname: string): boolean {
  const path = String(pathname || "").split("?")[0];
  return path === "/empresa" || path.startsWith("/empresa/");
}
