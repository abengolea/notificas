import { computeContentHash } from './certification';

export type EvidenceConsistencyInput = {
  messageId: string;
  mailData: Record<string, unknown> & {
    message?: { contentText?: string; text?: string };
    evidenceSnapshotHash?: string;
    readerUrl?: string;
    tracking?: { whatsappMessageId?: string; messageId?: string };
    whatsappMessageId?: string;
    polygonCertifications?: { contentHash?: string };
  };
  whatsappSent?: {
    buttons?: Array<{ url?: string | null; urlParameter?: string | null }>;
  } | null;
  /** Hash esperado del snapshot sellado (opcional). */
  snapshotContentHash?: string;
  snapshotHash?: string;
  evidenceSealed?: boolean;
};

export type EvidenceConsistencyResult = {
  ok: boolean;
  critical: string[];
  warnings: string[];
};

function extractMsgFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const msg = u.searchParams.get('msg');
    if (msg) return msg;
    const parts = u.pathname.split('/').filter(Boolean);
    const readerIdx = parts.indexOf('reader');
    if (readerIdx >= 0 && parts[readerIdx + 1]) return decodeURIComponent(parts[readerIdx + 1]);
    return null;
  } catch {
    const m = url.match(/[?&]msg=([^&]+)/);
    return m ? decodeURIComponent(m[1]) : null;
  }
}

/** Validación previa a emitir el PDF. Falla sólo ante inconsistencias críticas demostrables. */
export async function verifyEvidenceConsistency(
  input: EvidenceConsistencyInput
): Promise<EvidenceConsistencyResult> {
  const critical: string[] = [];
  const warnings: string[] = [];
  const { messageId, mailData } = input;
  const id = String(messageId || '').trim();
  if (!id) {
    critical.push('Falta identificador de mensaje.');
    return { ok: false, critical, warnings };
  }

  const trackingMsgId = mailData.tracking?.messageId;
  if (trackingMsgId && String(trackingMsgId) !== id) {
    critical.push(`messageId del tracking (${trackingMsgId}) no coincide con ${id}.`);
  }

  const readerUrl = typeof mailData.readerUrl === 'string' ? mailData.readerUrl : '';
  if (readerUrl) {
    const urlMsg = extractMsgFromUrl(readerUrl);
    if (urlMsg && urlMsg !== id) {
      critical.push(`readerUrl referencia messageId ${urlMsg}, distinto de ${id}.`);
    }
  }

  const waUrls = (input.whatsappSent?.buttons || [])
    .flatMap((b) => [b.url, b.urlParameter].filter((u): u is string => typeof u === 'string' && u.includes('msg=')));
  for (const url of waUrls) {
    const urlMsg = extractMsgFromUrl(url);
    if (urlMsg && urlMsg !== id) {
      critical.push(`Enlace de WhatsApp referencia messageId ${urlMsg}, distinto de ${id}.`);
    }
  }

  const wamidMail = mailData.whatsappMessageId;
  const wamidTracking = mailData.tracking?.whatsappMessageId;
  if (wamidMail && wamidTracking && wamidMail !== wamidTracking) {
    critical.push('WAMID del documento y del tracking no coinciden.');
  }

  const contentText = String(mailData.message?.contentText || mailData.message?.text || '').trim();
  const storedHash = String(mailData.polygonCertifications?.contentHash || input.snapshotContentHash || '').trim();
  if (contentText && storedHash) {
    const computed = await computeContentHash(contentText);
    if (computed !== storedHash.toLowerCase() && computed !== storedHash) {
      if (input.evidenceSealed) {
        critical.push('contentHash no coincide con SHA-256 del contenido certificado (snapshot sellado).');
      } else {
        warnings.push('contentHash registrado no coincide con el texto actual (sin snapshot sellado).');
      }
    }
  }

  const snapHash = String(input.snapshotHash || mailData.evidenceSnapshotHash || '').trim();
  if (input.snapshotHash && mailData.evidenceSnapshotHash && input.snapshotHash !== mailData.evidenceSnapshotHash) {
    critical.push('snapshotHash del snapshot no coincide con el registrado en el mail.');
  }

  if (input.evidenceSealed && !snapHash) {
    warnings.push('Envío marcado como sellado pero falta snapshotHash.');
  }

  return { ok: critical.length === 0, critical, warnings };
}

export class CertificateEvidenceError extends Error {
  constructor(
    message: string,
    readonly details: string[] = []
  ) {
    super(message);
    this.name = 'CertificateEvidenceError';
  }
}
