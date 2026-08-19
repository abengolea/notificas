/** SMTP aceptó el mensaje. No es entrega en la casilla. */
export function emailDeliveryLabel(
  state: string | undefined,
  bounce?: unknown
): string {
  if (bounce) return "Rebotó (no llegó al buzón)";
  switch (String(state || "").toUpperCase()) {
    case "DELIVERED":
    case "SUCCESS":
      return "Aceptado por el servidor de correo";
    case "ERROR":
      return "Error de envío";
    case "PENDING":
      return "Pendiente";
    default:
      return state || "Pendiente";
  }
}

/** Distingue un Message-ID SMTP real de marcas internas (p. ej. whatsapp-only). */
export function isRealSmtpMessageId(value: unknown): boolean {
  const s = String(value || "").trim();
  if (!s) return false;
  if (/^whatsapp/i.test(s)) return false;
  if (/^(DELIVERED|SUCCESS|PENDING|ERROR)$/i.test(s)) return false;
  return s.includes("@") || s.startsWith("<");
}
