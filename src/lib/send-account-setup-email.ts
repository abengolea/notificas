import { getAdminAuth } from "@/lib/firebase-admin";
import { createMailDocumentAdmin } from "@/lib/email-server";
import { sendEmailCfHeaders } from "@/lib/cf-send-auth";
import { DEFAULT_CONTACT_FROM_EMAIL, getFirebaseSendEmailUrl } from "@/lib/mail-defaults";
import { buildSystemEmailHtml } from "@/lib/email-template";

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
      headers: sendEmailCfHeaders(),
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
    html: options.html.replaceAll("{{PASSWORD_LINK}}", escapeHref(link)),
    text: options.text.replaceAll("{{PASSWORD_LINK}}", link),
    createdBy: options.createdBy,
    contactRequest: true,
  });

  return dispatchMailDoc(docId);
}

function originFromUrl(raw: string): string | null {
  try {
    return new URL(raw).origin;
  } catch {
    return null;
  }
}

export type PasswordLinkEmailKind = "migration" | "reset";

function passwordLinkCopy(kind: PasswordLinkEmailKind) {
  if (kind === "migration") {
    return {
      badge: "MIGRACIÓN",
      title: "Definí tu contraseña",
      subtitle: "Cuenta migrada mediante <strong>Notificas.com</strong>",
      preheader: "Definí tu contraseña para entrar a la nueva Notificas",
      subject: "Notificas — enlace para definir tu contraseña",
      intro: `<p class="lead">Hola,</p>
<p class="lead">Tu cuenta de Notificas anterior ya está en el sistema nuevo. Para activarla, definí o restablecé tu contraseña con el botón siguiente.</p>`,
      ctaLabel: "Definir contraseña",
    };
  }
  return {
    badge: "CUENTA",
    title: "Restablecé tu contraseña",
    subtitle: "Mensaje automático de <strong>Notificas.com</strong>",
    preheader: "Restablecé tu contraseña en Notificas",
    subject: "Notificas — restablecé tu contraseña",
    intro: `<p class="lead">Hola,</p>
<p class="lead">Recibimos un pedido para definir o restablecer tu contraseña en Notificas. Usá el botón siguiente para continuar.</p>`,
    ctaLabel: "Restablecer contraseña",
  };
}

/** Correo branded de migración o reset de contraseña (cola `mail` + sendEmail). */
export async function sendPasswordLinkEmail(options: {
  kind: PasswordLinkEmailKind;
  email: string;
  continueUrl: string;
  createdBy: string;
}): Promise<SendAccountSetupEmailResult> {
  const copy = passwordLinkCopy(options.kind);
  const logoBase = getAppPublicBaseUrl() || originFromUrl(options.continueUrl);
  const loginUrl = options.continueUrl;

  const html = buildSystemEmailHtml({
    badge: copy.badge,
    title: copy.title,
    subtitle: copy.subtitle,
    preheader: copy.preheader,
    recipientEmail: options.email.trim().toLowerCase(),
    logoUrl: logoBase ? `${logoBase}/notificasLogo.jpg` : null,
    bodyHtml: `
              ${copy.intro}
              <p class="lead">Después de este paso, ingresá desde:
                <a href="${escapeHref(loginUrl)}" style="color:#0D9488;">${escapeHtml(loginUrl)}</a>
              </p>
    `.trim(),
    ctaLabel: copy.ctaLabel,
    ctaHref: "{{PASSWORD_LINK}}",
  });

  const text = `${copy.preheader}.

Definí tu contraseña: {{PASSWORD_LINK}}

Luego ingresá en: ${loginUrl}
`;

  return sendAccountPasswordSetupEmail({
    email: options.email,
    continueUrl: options.continueUrl,
    subject: copy.subject,
    html,
    text,
    createdBy: options.createdBy,
  });
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
    ? `<p class="lead">Se dio de alta tu acceso como responsable de <strong>${escapeHtml(orgNombre)}</strong> en Notificas.</p>
<p class="lead">Para activar la cuenta, definí tu contraseña con el botón siguiente y luego ingresá al módulo de empresas.</p>`
    : `<p class="lead">Tu usuario quedó vinculado como responsable de <strong>${escapeHtml(orgNombre)}</strong> en Notificas.</p>
<p class="lead">Podés definir o actualizar tu contraseña con el botón siguiente. Si ya entrás con Google, también podés usar «Continuar con Google» en el login.</p>`;

  const html = buildSystemEmailHtml({
    badge: "ACCESO EMPRESA",
    title: "Activá tu cuenta de empresa",
    subtitle: `Alta de <strong>${escapeHtml(orgNombre)}</strong> mediante <strong>Notificas.com</strong>`,
    preheader: `Activá tu cuenta de empresa en Notificas (${orgNombre})`,
    recipientEmail: options.email.trim().toLowerCase(),
    logoUrl: `${base}/notificasLogo.jpg`,
    bodyHtml: `
              <p class="lead">Hola,</p>
              ${intro}
              <p class="lead">Después de definir la contraseña, accedé desde:
                <a href="${escapeHref(loginUrl)}" style="color:#0D9488;">${escapeHtml(loginUrl)}</a>
              </p>
    `.trim(),
    ctaLabel: "Activar cuenta y definir contraseña",
    ctaHref: "{{PASSWORD_LINK}}",
  });

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
