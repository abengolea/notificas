export type MovementChannel = "correo" | "whatsapp" | "lectura";

export function movementChannel(type: string): MovementChannel {
  if (type.startsWith("whatsapp_")) return "whatsapp";
  if (
    type === "read_confirmed" ||
    type === "reader_magic_open" ||
    type === "app_opened" ||
    type === "attachment_opened"
  ) {
    return "lectura";
  }
  return "correo";
}

export function movementChannelLabel(channel: MovementChannel): string {
  if (channel === "whatsapp") return "WhatsApp";
  if (channel === "lectura") return "Página web";
  return "Correo";
}

/** Títulos para el listado de movimientos. Sin nombres de proveedores. */
export const MOVEMENT_TYPE_LABELS: Record<string, string> = {
  email_sent: "CORREO ENVIADO",
  resend_sent: "CORREO ACEPTADO PARA ENTREGA",
  resend_delivered: "CORREO LLEGÓ AL SERVIDOR",
  resend_delayed: "CORREO DEMORADO",
  resend_bounced: "CORREO REBOTÓ",
  resend_failed: "CORREO NO SE PUDO ENVIAR",
  resend_suppressed: "CORREO BLOQUEADO",
  resend_complained: "CORREO MARCADO COMO SPAM",
  resend_opened_signal: "SEÑAL DE APERTURA (CORREO)",
  resend_clicked_signal: "SEÑAL DE CLIC (CORREO)",
  email_opened: "CORREO ABIERTO",
  read_confirmed: "LECTURA CONFIRMADA (PÁGINA WEB)",
  attachment_opened: "ARCHIVO ABIERTO (PÁGINA WEB)",
  link_clicked: "ENLACE PULSADO (CORREO)",
  whatsapp_link_clicked: "ENLACE PULSADO (WHATSAPP)",
  whatsapp_sent: "WHATSAPP ENVIADO",
  whatsapp_delivered: "WHATSAPP ENTREGADO",
  whatsapp_read: "WHATSAPP LEÍDO",
  whatsapp_failed: "WHATSAPP NO ENTREGADO",
  reader_magic_open: "NOTIFICACIÓN ABIERTA (PÁGINA WEB)",
};

const RESEND_DESCRIPTION_REWRITES: Array<[RegExp, string]> = [
  [/Resend aceptó el mensaje para entrega\.?/gi, "El servicio de correo aceptó el mensaje para enviarlo."],
  [
    /Resend informó que el servidor de correo del destinatario aceptó el mensaje\.?/gi,
    "El servidor de correo del destinatario aceptó el mensaje.",
  ],
  [/Resend informó demora temporal de entrega\.?/gi, "La entrega del correo se demoró temporalmente."],
  [/Resend informó rebote: el mensaje no llegó al buzón\.?/gi, "El correo rebotó: no llegó al buzón."],
  [/Resend informó fallo de envío\.?/gi, "El correo no se pudo enviar."],
  [/Resend no envió: dirección en lista de supresión\.?/gi, "El correo no se envió: la dirección está bloqueada."],
  [/Resend informó marca de spam\.?/gi, "Marcaron el correo como spam."],
  [
    /Señal técnica de apertura informada por Resend \(pixel\/proxy\)\.?/gi,
    "Señal técnica de apertura del correo. No es lectura fehaciente.",
  ],
  [/Señal técnica de clic informada por Resend\.?/gi, "Señal técnica de clic en el correo. No es lectura fehaciente."],
  [/\bResend\b/g, "el servicio de correo"],
];

/** Quita jerga de proveedor en textos ya guardados. */
export function publicMovementDescription(raw: string): string {
  let text = String(raw || "")
    .replace(/\s*No es lectura fehaciente\.?/gi, "")
    .replace(/\s*No es lectura\.?/gi, "")
    .replace(/\s*No equivale a lectura fehaciente\.?/gi, "")
    .replace(/\s*No equivale a acceso al reader\.?/gi, "")
    .trim();
  for (const [pattern, replacement] of RESEND_DESCRIPTION_REWRITES) {
    text = text.replace(pattern, replacement);
  }
  return text.replace(/\s{2,}/g, " ").trim();
}

export function publicMovementBrowserLabel(browser: string): string {
  if (!browser || browser === "Server") return "";
  if (browser === "Unknown") return "Desconocido";
  if (/^resend/i.test(browser)) return "Servicio de correo";
  if (browser === "WhatsApp Cloud API" || browser === "Sistema (WhatsApp de Meta)") return "WhatsApp";
  return browser;
}
