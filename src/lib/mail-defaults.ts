/**
 * Valores por defecto del proyecto (formulario contacto + Cloud Function sendEmail).
 * Se pueden sobrescribir con variables de entorno.
 */
export const DEFAULT_FIREBASE_SENDEMAIL_URL =
  "https://sendemail-ju7n3yysfq-uc.a.run.app";

export const DEFAULT_CONTACT_INBOX_EMAIL = "contacto@notificas.com";

export const DEFAULT_CONTACT_FORM_CREATED_BY = "contact-form-web";

/** Contacto: remitente visible en SMTP (misma cuenta que el producto). */
export const DEFAULT_CONTACT_FROM_EMAIL = "contacto@notificas.com";

/** Nombre que ve el destinatario en la bandeja (Gmail, Outlook, etc.). */
export const DEFAULT_CONTACT_FROM_DISPLAY_NAME = "Notificas";

/** Formato SMTP: `Notificas <contacto@notificas.com>` */
export function formatContactFromEmail(
  email: string = DEFAULT_CONTACT_FROM_EMAIL,
  displayName: string = DEFAULT_CONTACT_FROM_DISPLAY_NAME,
): string {
  const addr = email.trim();
  if (/^[^<]+<[^>]+>$/.test(addr)) return addr;
  return `${displayName} <${addr}>`;
}

export function getFirebaseSendEmailUrl(): string {
  const v =
    process.env.FIREBASE_SENDEMAIL_URL?.trim() ||
    DEFAULT_FIREBASE_SENDEMAIL_URL;
  return v.replace(/\/$/, "");
}

export function getContactInboxEmail(): string {
  return (
    process.env.CONTACT_INBOX_EMAIL?.trim() || DEFAULT_CONTACT_INBOX_EMAIL
  );
}

export function getContactFormCreatedBy(): string {
  return (
    process.env.CONTACT_FORM_CREATED_BY?.trim() ||
    DEFAULT_CONTACT_FORM_CREATED_BY
  );
}

/** Email que recibe notificación de nuevos reclamos de consumidores. */
export const DEFAULT_RECLAMOS_NOTIFY_EMAIL = "abengolea1@gmail.com";

export const DEFAULT_RECLAMOS_CREATED_BY = "reclamos-web";

export function getReclamosNotifyEmail(): string {
  return (
    process.env.RECLAMOS_NOTIFY_EMAIL?.trim() || DEFAULT_RECLAMOS_NOTIFY_EMAIL
  );
}

export function getReclamosCreatedBy(): string {
  return (
    process.env.RECLAMOS_CREATED_BY?.trim() || DEFAULT_RECLAMOS_CREATED_BY
  );
}
