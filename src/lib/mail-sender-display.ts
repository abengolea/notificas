/**
 * Remitente visible en la app: el usuario de Notificas, no la casilla SMTP.
 * `from` es siempre contacto@ / notificaciones@ porque el correo sale de la plataforma.
 */

const PLATFORM_TRANSPORT_LOCAL = new Set([
  "contacto",
  "notificaciones",
  "noreply",
  "no-reply",
  "mailer",
]);

function extractEmailAddress(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const angle = trimmed.match(/<([^<>]+)>/);
  const candidate = (angle?.[1] ?? trimmed).trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidate)) return undefined;
  return candidate;
}

export function isPlatformTransportEmail(email: string): boolean {
  const at = email.lastIndexOf("@");
  if (at < 0) return false;
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  if (domain !== "notificas.com" && domain !== "notificas.com.ar") return false;
  return PLATFORM_TRANSPORT_LOCAL.has(local);
}

/** Mail del remitente de Notificas para listados y ficha. */
export function displayMailSender(mail: Record<string, unknown>): string {
  const candidates = [mail.senderName, mail.replyTo, mail.sender, mail.from];
  for (const candidate of candidates) {
    const email = extractEmailAddress(candidate);
    if (email && !isPlatformTransportEmail(email)) return email;
  }

  if (typeof mail.senderName === "string") {
    const name = mail.senderName.trim();
    const asEmail = extractEmailAddress(name);
    if (
      name &&
      name.toLowerCase() !== "notificas" &&
      (!asEmail || !isPlatformTransportEmail(asEmail))
    ) {
      return name;
    }
  }

  return "—";
}
