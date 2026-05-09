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
