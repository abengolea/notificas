export const WA_TEMPLATE_LANGS = [
  { value: "es_AR", label: "Español (Argentina)" },
  { value: "es", label: "Español" },
  { value: "es_MX", label: "Español (México)" },
  { value: "en_US", label: "English (US)" },
  { value: "pt_BR", label: "Português (Brasil)" },
] as const;

export const WA_TEMPLATE_VARIABLE_OPTIONS = [
  { value: "nombre", label: "nombre" },
  { value: "dni", label: "dni" },
  { value: "legajo", label: "legajo" },
  { value: "email", label: "email" },
  { value: "telefono", label: "telefono" },
  { value: "dias", label: "días de atraso" },
  { value: "area", label: "área" },
  { value: "remitente", label: "remitente (empresa)" },
  { value: "url_lectura", label: "link del lector (mismo que el correo)" },
] as const;

export const WA_TEMPLATE_MAX_VARS = 10;

/** Template aprobado de Notificas: {{1}} nombre, {{2}} remitente, {{3}} link de lectura. */
export const WA_DEFAULT_TEMPLATE_NAME = "notificaciones_notificas";
export const WA_TEMPLATE_DEFAULT_VARS = ["nombre", "remitente", "url_lectura"];

/** Cuerpo alineado con el template aprobado notificaciones_notificas ({{1}} nombre, {{2}} remitente, {{3}} URL). */
export const WA_DEFAULT_TEMPLATE_BODY =
  "Estimado/a {{1}},\n\nLe informamos que {{2}} le ha enviado una notificación digital certificada a través de Notificas.com.\n\nAcceda al contenido aquí:\n{{3}}\n\nSi no reconoce este envío, ignore este mensaje. Consultas: contacto@notificas.com\n\n— Notificas.com";

export function usesNotificasDefaultTemplate(name: string | undefined | null): boolean {
  const n = String(name || "").trim().toLowerCase();
  return !n || n === WA_DEFAULT_TEMPLATE_NAME;
}

export const WA_TEMPLATE_HINT =
  "Agregá una fila por cada {{N}} del cuerpo en Meta, en el mismo orden. Un template de 5 variables necesita 5 filas. Un campo vacío hace fallar el envío con error 131008.";

export const WA_DEFAULT_TEMPLATE_HINT =
  "Si no elegís otro template, se usa notificaciones_notificas. El sistema completa {{1}} nombre, {{2}} remitente y {{3}} el mismo lector de la notificación que el correo.";

export function explainWhatsAppSendError(raw: string | undefined | null): string | null {
  const t = String(raw || "");
  if (!t) return null;
  if (t.includes("131008") || /required parameter is missing/i.test(t)) {
    return "Meta rechazó el template: falta un parámetro o llegó vacío. Suele ser (1) más o menos {{N}} que en Meta, (2) un dato vacío (legajo, DNI, días), o (3) el template tiene botón URL y no está activado acá. Ajustá el template en Mensaje y reintentá.";
  }
  return null;
}
