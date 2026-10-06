export const ELECTRONIC_NOTIFICATION_WARNING_TITLE =
  "Este tipo de envío exige adhesión previa";

export const ELECTRONIC_NOTIFICATION_WARNING_BODY =
  "Solo se entrega a personas que ya se adhirieron a la notificación electrónica. Si no hay adhesión, el envío se bloquea y hay que notificar por vía convencional (carta). Para una intimación o un aviso normal, elegí comunicación ordinaria.";

const BLOCK_CODES = new Set([
  "REQUIRES_CONVENTIONAL_CHANNEL",
  "NO_ADHESION",
  "REVOKED",
  "SUSPENDED",
  "CONTACT_NOT_VERIFIED",
  "IDENTITY_NOT_VERIFIED",
  "MODULE_DISABLED",
  "ART_MODULE_NOT_AVAILABLE",
  "OTHER",
]);

export const ELECTRONIC_NOTIFICATION_BLOCK_MESSAGE =
  "No se envió: el destinatario no tiene adhesión electrónica activa. Para este aviso usá comunicación ordinaria, o notificá por vía convencional (carta).";

export function explainElectronicNotificationBlock(raw: string | undefined | null): string | null {
  const t = String(raw || "").trim();
  if (!t) return null;
  if (BLOCK_CODES.has(t) || /REQUIRES_CONVENTIONAL_CHANNEL|adhesi[oó]n/i.test(t)) {
    return ELECTRONIC_NOTIFICATION_BLOCK_MESSAGE;
  }
  return null;
}
