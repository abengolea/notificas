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
  { value: "fecha", label: "fecha" },
  { value: "monto", label: "monto" },
  { value: "area", label: "área" },
  { value: "remitente", label: "remitente (empresa)" },
  { value: "url_lectura", label: "link del lector (mismo que el correo)" },
] as const;

/** Prefijo guardado en waTemplateVariables para un texto igual en todos los destinatarios. */
export const WA_LITERAL_PREFIX = "=";

const WA_FIELD_IDENT_RE = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

export function isWaLiteralVar(field: string | undefined | null): boolean {
  const f = String(field || "").trim();
  if (!f) return false;
  if (f.startsWith(WA_LITERAL_PREFIX)) return true;
  return !WA_FIELD_IDENT_RE.test(f);
}

export function waLiteralText(field: string | undefined | null): string {
  const f = String(field || "");
  return f.startsWith(WA_LITERAL_PREFIX) ? f.slice(WA_LITERAL_PREFIX.length) : f;
}

export function encodeWaLiteral(text: string): string {
  return `${WA_LITERAL_PREFIX}${text}`;
}

export function isWaTemplateVarEmpty(field: string | undefined | null): boolean {
  const f = String(field || "").trim();
  if (!f) return true;
  if (isWaLiteralVar(f) && !waLiteralText(f).trim()) return true;
  return false;
}

const WA_VARS_NOT_IN_CSV = new Set([
  "nombre",
  "dni",
  "telefono",
  "email",
  "remitente",
  "empresa",
  "url_lectura",
  "boton_url",
]);

/** Columnas extra del CSV que pide el mapeo {{N}} (ignora texto fijo y campos de contacto). */
export function csvColumnsFromWaVariables(variables: string[] | undefined | null): string[] {
  const out: string[] = [];
  for (const raw of variables || []) {
    const f = String(raw || "").trim();
    if (!f || isWaLiteralVar(f) || WA_VARS_NOT_IN_CSV.has(f)) continue;
    const col = f === "dias_atraso" ? "dias" : f;
    if (!out.includes(col)) out.push(col);
  }
  return out;
}

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
  "Agregá una fila por cada {{N}} del cuerpo en Meta, en el mismo orden. En el paso Destinatarios el CSV tiene que traer esas columnas. Si un dato es igual para todos, usá «texto fijo» y no hace falta la columna.";}

export const WA_DEFAULT_TEMPLATE_HINT =
  "Si no elegís otro template, se usa notificaciones_notificas. El sistema completa {{1}} nombre, {{2}} remitente y {{3}} el mismo lector de la notificación que el correo.";

export function explainWhatsAppSendError(raw: string | undefined | null): string | null {
  const t = String(raw || "");
  if (!t) return null;
  if (t.includes("131008") || /required parameter is missing/i.test(t)) {
    return "Meta rechazó el template: falta un parámetro o llegó vacío. Suele ser (1) más o menos {{N}} que en Meta, (2) un dato vacío (legajo, DNI, días, fecha, monto), o (3) el template tiene botón URL y no está activado acá. Ajustá el template de WhatsApp y reintentá.";
  }
  return null;
}
