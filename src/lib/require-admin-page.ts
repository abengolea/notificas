import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  ADMIN_SESSION_COOKIE,
  getAdminPanelConfig,
  verifyAdminSessionToken,
} from "@/lib/admin-session";

/** Redirige a login si no hay cookie de panel admin. Solo para páginas, no APIs. */
export async function requireAdminPage(): Promise<void> {
  const cfg = getAdminPanelConfig();
  if (!cfg) redirect("/admin/login");
  const raw = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value;
  if (!raw || !verifyAdminSessionToken(raw, cfg.secret, cfg.email)) {
    redirect("/admin/login");
  }
}
