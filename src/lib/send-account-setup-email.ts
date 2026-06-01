import { getAdminAuth } from "@/lib/firebase-admin";
import { createMailDocumentAdmin } from "@/lib/email-server";
import { DEFAULT_CONTACT_FROM_EMAIL, getFirebaseSendEmailUrl } from "@/lib/mail-defaults";

function escapeHtml(s: string) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeHref(s: string) {
  return String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

/** URL pública de la app para enlaces en correos (admin / servidor). */
export function getAppPublicBaseUrl(): string | null {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!raw) return null;
  try {
    const u = new URL(raw);
    return u.origin;
  } catch {
    return null;
  }
}

export type SendAccountSetupEmailResult =
  | { ok: true; mailDocId: string }
  | { ok: false; error: string; status?: number };

async function dispatchMailDoc(docId: string): Promise<SendAccountSetupEmailResult> {
  const fnUrl = getFirebaseSendEmailUrl();
  const cfController = new AbortController();
  const cfTimeout = setTimeout(() => cfController.abort(), 55_000);
  try {
    const cfRes = await fetch(fnUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ docId }),
      signal: cfController.signal,
    });
    const cfBody = (await cfRes.json().catch(() => ({}))) as { error?: string };
    if (!cfRes.ok) {
      return { ok: false, error: cfBody.error || "Error al enviar el correo.", status: cfRes.status };
    }
    return { ok: true, mailDocId: docId };
  } catch (fetchErr: unknown) {
    const msg =
      fetchErr instanceof Error && fetchErr.name === "AbortError"
        ? "Timeout al enviar correo"
        : fetchErr instanceof Error
          ? fetchErr.message
          : "Error al enviar correo";
    return { ok: false, error: msg, status: 502 };
  } finally {
    clearTimeout(cfTimeout);
  }
}

/**
 * Genera enlace Firebase de contraseña y lo envía por la cola `mail` + Cloud Function sendEmail.
 */
export async function sendAccountPasswordSetupEmail(options: {
  email: string;
  continueUrl: string;
  subject: string;
  html: string;
  text: string;
  createdBy: string;
}): Promise<SendAccountSetupEmailResult> {
  const email = options.email.trim().toLowerCase();
  const auth = getAdminAuth();

  let link: string;
  try {
    link = await auth.generatePasswordResetLink(email, {
      url: options.continueUrl,
      handleCodeInApp: false,
    });
  } catch (e) {
    console.error("[send-account-setup-email] generatePasswordResetLink", e);
    return { ok: false, error: "No se pudo generar el enlace de contraseña." };
  }

  const docId = await createMailDocumentAdmin({
    to: email,
    from: DEFAULT_CONTACT_FROM_EMAIL,
    subject: options.subject,
    html: options.html.replace("{{PASSWORD_LINK}}", escapeHref(link)),
    text: options.text.replace("{{PASSWORD_LINK}}", link),
    createdBy: options.createdBy,
    contactRequest: true,
  });

  return dispatchMailDoc(docId);
}

/** Correo de bienvenida B2B tras alta desde panel admin. */
export async function sendEmpresaAdminOnboardingEmail(options: {
  email: string;
  orgNombre: string;
  authCreated: boolean;
}): Promise<SendAccountSetupEmailResult> {
  const base = getAppPublicBaseUrl();
  if (!base) {
    return {
      ok: false,
      error: "Falta NEXT_PUBLIC_APP_URL en el servidor para armar el enlace de acceso.",
    };
  }

  const loginUrl = `${base}/login?next=${encodeURIComponent("/empresa")}`;
  const orgNombre = options.orgNombre.trim() || "tu organización";
  const intro = options.authCreated
    ? `<p>Se dio de alta tu acceso como responsable de <strong>${escapeHtml(orgNombre)}</strong> en Notificas.</p>
<p>Para activar la cuenta, definí tu contraseña con el enlace siguiente y luego ingresá al módulo de empresas:</p>`
    : `<p>Tu usuario quedó vinculado como responsable de <strong>${escapeHtml(orgNombre)}</strong> en Notificas.</p>
<p>Podés definir o actualizar tu contraseña con el enlace siguiente (si ya entrás con Google, también podés usar «Continuar con Google» en el login):</p>`;

  const html = `
<p>Hola,</p>
${intro}
<p><a href="{{PASSWORD_LINK}}">Activar cuenta y definir contraseña</a></p>
<p>Después del paso anterior, accedé desde: <a href="${escapeHref(loginUrl)}">${escapeHtml(loginUrl)}</a></p>
<p>Si el botón no funciona, copiá y pegá esta dirección en el navegador:</p>
<pre style="white-space:pre-wrap;word-break:break-all">{{PASSWORD_LINK}}</pre>
<p style="color:#666;font-size:12px">Mensaje automático — no respondas a este correo.</p>
`.trim();

  const text = `Alta de empresa en Notificas (${orgNombre}).

Definí tu contraseña: {{PASSWORD_LINK}}

Luego ingresá en: ${loginUrl}
`;

  return sendAccountPasswordSetupEmail({
    email: options.email,
    continueUrl: loginUrl,
    subject: `Notificas — activá tu cuenta de empresa (${orgNombre})`,
    html,
    text,
    createdBy: "api:admin-organizations-onboarding",
  });
}
