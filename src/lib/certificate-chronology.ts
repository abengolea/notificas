import { firstCertificateMovement, type CertificateMovement } from './certificate-email-evidence';

export type ChronologyRow = { timestamp: unknown; label: string };

const CHRONOLOGY_TYPE_LABELS: Record<string, string> = {
  email_sent: 'Correo enviado y aceptado',
  resend_sent: 'Correo enviado y aceptado',
  resend_delivered: 'Servidor del destinatario aceptó el correo',
  resend_opened_signal: 'Apertura del correo informada por el proveedor',
  email_opened: 'Apertura del correo por pixel',
  link_clicked: 'Enlace del correo pulsado',
  whatsapp_sent: 'WhatsApp enviado',
  whatsapp_delivered: 'WhatsApp entregado al teléfono',
  whatsapp_read: 'Meta informó que el mensaje fue leído en el chat',
  whatsapp_link_clicked: 'Enlace del mensaje de WhatsApp pulsado',
  reader_magic_open: 'Se registró acceso al lector certificado',
  read_confirmed: 'Se registró confirmación de lectura en el lector',
};

function movementTime(value: unknown): number {
  if (!value) return Number.NaN;
  if (typeof value === 'string') return new Date(value).getTime();
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'object' && value && 'seconds' in value) {
    return Number((value as { seconds: number }).seconds) * 1000;
  }
  if (typeof value === 'object' && value && 'toDate' in value) {
    try {
      return (value as { toDate: () => Date }).toDate().getTime();
    } catch {
      return Number.NaN;
    }
  }
  return Number.NaN;
}

/** Cronología Parte I: todos los hechos relevantes, ordenados por hora real. */
export function buildSortedChronologyRows(movements: CertificateMovement[]): ChronologyRow[] {
  const rows: ChronologyRow[] = [];
  const seen = new Set<string>();

  for (const m of movements) {
    const type = String(m.type || '').toLowerCase();
    const label = CHRONOLOGY_TYPE_LABELS[type];
    if (!label || !m.timestamp) continue;
    const key = `${type}:${movementTime(m.timestamp)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({ timestamp: m.timestamp, label });
  }

  // Fallback si faltan movimientos clave pero existen en firstMovement pattern
  const fallbacks: Array<[string[], string]> = [
    [['email_sent', 'resend_sent'], 'Correo enviado y aceptado'],
    [['whatsapp_sent'], 'WhatsApp enviado'],
  ];
  for (const [types, label] of fallbacks) {
    if (rows.some((r) => r.label === label)) continue;
    const m = firstCertificateMovement(movements, types);
    if (m?.timestamp) rows.push({ timestamp: m.timestamp, label });
  }

  return rows.sort((a, b) => {
    const ta = movementTime(a.timestamp);
    const tb = movementTime(b.timestamp);
    if (Number.isNaN(ta) && Number.isNaN(tb)) return 0;
    if (Number.isNaN(ta)) return 1;
    if (Number.isNaN(tb)) return -1;
    return ta - tb;
  });
}
