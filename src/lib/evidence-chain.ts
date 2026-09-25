import { createHash } from 'crypto';

/** Metadatos probatorios para accesos vía enlace o lector (sin secretos completos). */
export type AccessEvidenceFields = {
  messageId: string;
  movementId: string;
  contentHash?: string;
  snapshotHash?: string;
  wamid?: string;
  recipientPhone?: string;
  recipientEmail?: string;
  tokenRef?: string;
  linkKind?: 'whatsapp_cta' | 'whatsapp_link' | 'email_cta' | 'email_link' | 'reader';
};

export function tokenReference(token: unknown): string | undefined {
  const t = typeof token === 'string' ? token.trim() : '';
  if (!t) return undefined;
  return createHash('sha256').update(t, 'utf8').digest('hex').slice(0, 16);
}

export function shortenHash(hash: unknown): string {
  const h = typeof hash === 'string' ? hash.trim() : '';
  if (!h) return '—';
  if (h.length <= 20) return h;
  return `${h.slice(0, 8)}…${h.slice(-8)}`;
}

export function buildAccessEvidenceFields(
  mail: Record<string, unknown>,
  messageId: string,
  movementId: string,
  opts?: { linkKind?: AccessEvidenceFields['linkKind']; token?: unknown }
): AccessEvidenceFields {
  const poly =
    mail.polygonCertifications && typeof mail.polygonCertifications === 'object'
      ? (mail.polygonCertifications as Record<string, unknown>)
      : {};
  const tracking =
    mail.tracking && typeof mail.tracking === 'object'
      ? (mail.tracking as Record<string, unknown>)
      : {};
  return {
    messageId,
    movementId,
    contentHash: String(poly.contentHash || '').trim() || undefined,
    snapshotHash: String(mail.evidenceSnapshotHash || '').trim() || undefined,
    wamid: String(mail.whatsappMessageId || tracking.whatsappMessageId || '').trim() || undefined,
    recipientPhone: String(mail.recipientPhone || '').trim() || undefined,
    recipientEmail: String(mail.recipientEmail || mail.to || '').trim() || undefined,
    tokenRef: tokenReference(opts?.token ?? tracking.token),
    linkKind: opts?.linkKind,
  };
}

export function buildEvidenceChainSteps(input: {
  hasWhatsApp: boolean;
  messageId: string;
  contentHash: string;
  snapshotHash?: string;
  hasPolygon: boolean;
}): string[] {
  const steps: string[] = [];
  if (input.hasWhatsApp) steps.push('Mensaje de WhatsApp enviado al destinatario');
  steps.push('Enlace certificado incluido en el mensaje');
  steps.push(`Lector certificado (identificador ${input.messageId})`);
  steps.push('Texto intimado certificado (único contenido jurídico de este documento)');
  steps.push(`Huella SHA-256 del contenido: ${shortenHash(input.contentHash)}`);
  if (input.snapshotHash) steps.push(`Snapshot inmutable: ${shortenHash(input.snapshotHash)}`);
  if (input.hasPolygon) steps.push('Anclaje en Polygon');
  return steps;
}

/** Una sola línea (ASCII, sin Unicode) para tests o uso textual. */
export function buildEvidenceChainLine(input: {
  hasWhatsApp: boolean;
  messageId: string;
  contentHash: string;
  snapshotHash?: string;
  hasPolygon: boolean;
}): string {
  return buildEvidenceChainSteps(input)
    .map((s, i) => `${i + 1}. ${s}`)
    .join(' ');
}

export function whatsAppReaderLinkExplanation(messageId: string, contentHash: string): string {
  return (
    `El enlace incluido en este mensaje conduce al lector certificado del identificador ${messageId}. ` +
    `El contenido exhibido por ese lector es el transcripto íntegramente en la sección «Contenido certificado mostrado en el lector» ` +
    `y se identifica mediante el hash SHA-256 ${contentHash || '—'}.`
  );
}

export function certifiedContentLegend(messageId: string, contentHash: string): string {
  return (
    `Este es el contenido certificado asociado al identificador de mensaje ${messageId}, preservado en el snapshot inmutable al momento del envío. ` +
    `Su integridad se verifica mediante el hash SHA-256 ${contentHash || '—'}.`
  );
}
