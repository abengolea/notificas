/** Campos de `mail.polygonCertifications` que son hashes de TX (no metadata). */
export const POLYGON_CERT_DISPLAY_ORDER = [
  'send',
  'waDelivered',
  'waRead',
  'contentAccess',
  'readConfirmed',
  'receive',
  'read',
  'certificate',
] as const;

const BASE_LABELS: Record<string, string> = {
  send: 'Envío certificado',
  waDelivered: 'WhatsApp entregado',
  waRead: 'WhatsApp leído',
  contentAccess: 'Acceso al contenido',
  readConfirmed: 'Lectura confirmada',
  receive: 'Recepción certificada (histórico)',
  read: 'Lectura certificada (histórico)',
  certificate: 'Certificado PDF anclado',
};

const ACCESS_VIA_LABELS: Record<string, string> = {
  email: 'Acceso al contenido · correo',
  whatsapp: 'Acceso al contenido · enlace de WhatsApp',
  reader: 'Acceso al contenido · página de lectura',
  attachment: 'Acceso al contenido · adjunto',
};

export function polygonCertLabel(field: string, contentAccessVia?: string | null): string {
  if (field === 'contentAccess' && contentAccessVia && ACCESS_VIA_LABELS[contentAccessVia]) {
    return ACCESS_VIA_LABELS[contentAccessVia];
  }
  return BASE_LABELS[field] || field;
}
