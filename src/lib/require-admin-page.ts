import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  ADMIN_SESSION_COOKIE,
  getAdminPanelConfig,
  readAdminSessionEmail,
} from "@/lib/admin-session";

/** Redirige a login si no hay cookie de panel admin. Solo para páginas, no APIs. */
export async function requireAdminPage(nextPath?: string): Promise<string> {
  const cfg = getAdminPanelConfig();
  const login = nextPath
    ? `/admin/login?next=${encodeURIComponent(nextPath)}`
    : "/admin/login";
  if (!cfg) redirect(login);
  const raw = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value;
  const email = raw ? readAdminSessionEmail(raw, cfg.secret, cfg.email) : null;
  if (!email) redirect(login);
  return email;
}
