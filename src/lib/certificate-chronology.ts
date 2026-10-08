import { firstCertificateMovement, type CertificateMovement } from './certificate-email-evidence';

export type ChronologyRow = { timestamp: unknown; label: string };

/** Varias señales de correo al mismo segundo se muestran una sola vez en Parte I. */
const CHRONOLOGY_COLLAPSE_KEY: Record<string, string> = {
  email_sent: 'email_aceptado',
  resend_sent: 'email_aceptado',
  resend_delivered: 'email_aceptado',
};

const CHRONOLOGY_TYPE_LABELS: Record<string, string> = {
  email_sent: 'Correo enviado y aceptado',
  resend_sent: 'Correo enviado y aceptado',
  resend_delivered: 'Correo enviado y aceptado',
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

function secondBucket(ts: unknown): number {
  const t = movementTime(ts);
  return Number.isNaN(t) ? -1 : Math.floor(t / 1000);
}

/** Cronología Parte I: hechos relevantes, sin duplicar la misma idea al mismo segundo. */
export function buildSortedChronologyRows(movements: CertificateMovement[]): ChronologyRow[] {
  const rows: ChronologyRow[] = [];
  const seen = new Set<string>();
  const waLinkCount = movements.filter((m) => String(m.type || '').toLowerCase() === 'whatsapp_link_clicked').length;

  for (const m of movements) {
    const type = String(m.type || '').toLowerCase();
    if (type === 'whatsapp_link_clicked' && waLinkCount > 1) {
      continue;
    }
    const label = CHRONOLOGY_TYPE_LABELS[type];
    if (!label || !m.timestamp) continue;
    const collapse = CHRONOLOGY_COLLAPSE_KEY[type] || type;
    const key = `${collapse}:${secondBucket(m.timestamp)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({ timestamp: m.timestamp, label });
  }

  if (waLinkCount > 1) {
    const first = firstCertificateMovement(movements, ['whatsapp_link_clicked']);
    const collapseKey = `whatsapp_link_clicked:${secondBucket(first?.timestamp)}`;
    if (first?.timestamp && !seen.has(collapseKey)) {
      seen.add(collapseKey);
      rows.push({
        timestamp: first.timestamp,
        label: `Enlace del mensaje de WhatsApp pulsado (${waLinkCount} registros; detalle en bitácora)`,
      });
    }
  }

  const fallbacks: Array<[string[], string]> = [[['whatsapp_sent'], 'WhatsApp enviado']];
  for (const [types, label] of fallbacks) {
    if (rows.some((r) => r.label === label || r.label.startsWith(label))) continue;
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
