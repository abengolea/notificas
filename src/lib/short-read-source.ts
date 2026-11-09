/**
 * Origen del clic en un enlace corto `/n/CODE`.
 *
 * El mismo código sirve para correo y para WhatsApp. Sin distinguirlo, un clic en el correo
 * quedaba registrado como "pulsado desde WhatsApp" (y el certificado decía eso).
 *
 * 1. `?src=email|whatsapp` explícito (los correos nuevos llevan `?src=email`).
 * 2. Sin marca (correos viejos y todos los de WhatsApp): si el mensaje nunca se envió por
 *    WhatsApp, el clic solo puede venir del correo.
 * 3. Sin marca y con WhatsApp enviado: ambiguo, se mantiene el comportamiento histórico (WhatsApp).
 */
export type ShortReadSource = 'whatsapp' | 'email';

/** Campos del mensaje que bastan para saber si salió por WhatsApp. */
export const SHORT_READ_SOURCE_FIELDS = [
  'whatsappMessageId',
  'tracking.whatsappMessageId',
  'waRequestSnapshot',
  'waOnly',
] as const;

type MailLike = {
  whatsappMessageId?: unknown;
  waRequestSnapshot?: unknown;
  waOnly?: unknown;
  tracking?: { whatsappMessageId?: unknown } | null;
} | null;

export function mailWasSentByWhatsApp(mail: MailLike | undefined): boolean {
  if (!mail) return false;
  if (mail.waOnly === true) return true;
  if (typeof mail.whatsappMessageId === 'string' && mail.whatsappMessageId.trim()) return true;
  const tracked = mail.tracking?.whatsappMessageId;
  if (typeof tracked === 'string' && tracked.trim()) return true;
  return Boolean(mail.waRequestSnapshot);
}

export function resolveShortReadSource(
  srcParam: string | null | undefined,
  mail: MailLike | undefined,
  mailKnown: boolean,
): ShortReadSource {
  const s = String(srcParam || '').trim().toLowerCase();
  if (s === 'email') return 'email';
  if (s === 'whatsapp') return 'whatsapp';
  if (mailKnown && !mailWasSentByWhatsApp(mail)) return 'email';
  return 'whatsapp';
}
