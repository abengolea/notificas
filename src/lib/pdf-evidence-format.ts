/** Formato de PDFs de evidencia. El footer debe llevar esta etiqueta. */
export const PDF_SCHEMA = {
  constanciaEnvio: 'constancia-envio/v2',
  certificadoLectura: 'certificado-lectura/v2',
  actaTanda: 'acta-tanda/v2',
  actaIndividual: 'acta-individual/v3',
} as const;

const ART_TZ = 'America/Argentina/Buenos_Aires';

function toDate(value: unknown): Date | null {
  if (value == null || value === '') return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'number' && Number.isFinite(value)) {
    const ms = value < 1e12 ? value * 1000 : value;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === 'string') {
    if (/^\d+$/.test(value.trim())) {
      const n = Number(value);
      const ms = n < 1e12 ? n * 1000 : n;
      const d = new Date(ms);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === 'object') {
    const rec = value as { toDate?: () => Date; seconds?: number; _seconds?: number };
    if (typeof rec.toDate === 'function') {
      try {
        const d = rec.toDate();
        return d instanceof Date && !Number.isNaN(d.getTime()) ? d : null;
      } catch {
        return null;
      }
    }
    const secs = rec._seconds ?? rec.seconds;
    if (typeof secs === 'number' && Number.isFinite(secs)) {
      return new Date(secs * 1000);
    }
  }
  return null;
}

/** `2026-08-18T20:23:45Z (17:23:45 ART)` */
export function formatEvidenceTimestamp(value?: unknown): string {
  const d = toDate(value);
  if (!d) return '—';
  const utc = d.toISOString().replace(/\.\d{3}Z$/, 'Z');
  const art = new Intl.DateTimeFormat('es-AR', {
    timeZone: ART_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(d);
  return `${utc} (${art} ART)`;
}

export function metaAccountIdsFromSources(input: {
  mail?: Record<string, unknown> | null;
  requestSnapshot?: unknown;
  envFallback?: boolean;
}): { phoneNumberId: string | null; wabaId: string | null } {
  const mail = input.mail || {};
  const snap =
    input.requestSnapshot && typeof input.requestSnapshot === 'object'
      ? (input.requestSnapshot as Record<string, unknown>)
      : {};
  const fromMailPhone = String(mail.whatsappPhoneNumberId || snap.phoneNumberId || '').trim();
  const fromMailWaba = String(mail.whatsappWabaId || snap.wabaId || '').trim();
  const envPhone = input.envFallback ? String(process.env.WHATSAPP_PHONE_NUMBER_ID || '').trim() : '';
  const envWaba = input.envFallback
    ? String(process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '').trim()
    : '';
  return {
    phoneNumberId: fromMailPhone || envPhone || null,
    wabaId: fromMailWaba || envWaba || null,
  };
}
