import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  ADMIN_SESSION_COOKIE,
  getAdminPanelConfig,
  readAdminSessionEmail,
} from "@/lib/admin-session";
import { signExtensionConnectCode } from "@/lib/marketing/linkedin-assistant-tokens";

const CONNECT_PATH = "/admin/linkedin-assistant/connect";

export default async function LinkedInAssistantConnectPage() {
  const cfg = getAdminPanelConfig();
  if (!cfg) {
    redirect(`/admin/login?next=${encodeURIComponent(CONNECT_PATH)}`);
  }

  const raw = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value;
  const email = raw ? readAdminSessionEmail(raw, cfg.secret, cfg.email) : null;
  if (!email) {
    redirect(`/admin/login?next=${encodeURIComponent(CONNECT_PATH)}`);
  }

  const code = signExtensionConnectCode(email, cfg.secret);
  redirect(`${CONNECT_PATH}/done?code=${encodeURIComponent(code)}`);
}
