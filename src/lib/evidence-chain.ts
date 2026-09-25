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

export type EvidenceChainVisualStep =
  | { kind: 'line'; text: string }
  | { kind: 'arrow' }
  | { kind: 'id'; label: string; value: string };

export function buildEvidenceChainVisual(input: {
  hasWhatsApp: boolean;
  hasEmail?: boolean;
  messageId: string;
  contentHash: string;
  snapshotHash?: string;
  hasPolygon: boolean;
}): EvidenceChainVisualStep[] {
  const steps: EvidenceChainVisualStep[] = [];
  if (input.hasWhatsApp) {
    steps.push({ kind: 'line', text: 'WhatsApp enviado' });
    steps.push({ kind: 'arrow' });
  } else if (input.hasEmail !== false) {
    steps.push({ kind: 'line', text: 'Notificación enviada por correo electrónico' });
    steps.push({ kind: 'arrow' });
  }
  steps.push({ kind: 'line', text: 'Enlace certificado' });
  steps.push({ kind: 'arrow' });
  steps.push({ kind: 'line', text: 'Lector certificado' });
  steps.push({ kind: 'id', label: 'ID', value: input.messageId });
  steps.push({ kind: 'arrow' });
  steps.push({ kind: 'line', text: 'Contenido certificado' });
  steps.push({ kind: 'arrow' });
  steps.push({ kind: 'line', text: `SHA-256: ${shortenHash(input.contentHash)}` });
  if (input.snapshotHash) {
    steps.push({ kind: 'arrow' });
    steps.push({ kind: 'line', text: `Snapshot inmutable: ${shortenHash(input.snapshotHash)}` });
  }
  if (input.hasPolygon) {
    steps.push({ kind: 'arrow' });
    steps.push({ kind: 'line', text: 'Anclaje en Polygon' });
  }
  return steps;
}

export function buildEvidenceChainSteps(input: {
  hasWhatsApp: boolean;
  messageId: string;
  contentHash: string;
  snapshotHash?: string;
  hasPolygon: boolean;
}): string[] {
  return buildEvidenceChainVisual(input)
    .filter((s): s is { kind: 'line'; text: string } | { kind: 'id'; label: string; value: string } => s.kind !== 'arrow')
    .map((s) => (s.kind === 'id' ? `${s.label}: ${s.value}` : s.text));
}

export function canShowWhatsAppProbatoryPhrase(input: {
  hasWhatsApp: boolean;
  messageId: string;
  contentHash: string;
  whatsappLinkClicked?: boolean;
}): boolean {
  return Boolean(input.hasWhatsApp && input.messageId && input.contentHash && input.whatsappLinkClicked);
}

export function whatsAppProbatoryPhrase(messageId: string, contentHash: string): string {
  return (
    `El acceso registrado desde WhatsApp corresponde al mismo identificador de mensaje (${messageId}), ` +
    `al mismo lector certificado y al mismo contentHash consignado en este certificado (${shortenHash(contentHash)}).`
  );
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
  const hashDisplay = contentHash ? shortenHash(contentHash) : '—';
  return (
    `El enlace incluido en este mensaje conduce al lector certificado asociado al identificador ${messageId}. ` +
    `El contenido exhibido por dicho lector es el transcripto en la sección «Contenido certificado mostrado en el lector» ` +
    `y se encuentra identificado mediante el hash SHA-256 ${hashDisplay} (hash completo en el anexo técnico).`
  );
}

export function certifiedContentLegend(messageId: string, contentHash: string): string {
  const hashDisplay = contentHash ? shortenHash(contentHash) : '—';
  return (
    `Este es el contenido certificado asociado al identificador de mensaje ${messageId}, preservado en el snapshot inmutable al momento del envío. ` +
    `Su integridad se verifica mediante el hash SHA-256 ${hashDisplay} (hash completo en el anexo técnico).`
  );
}

export function whatsAppScopeExplanation(waOnly: boolean, hasRenderedBody: boolean): string {
  if (waOnly && hasRenderedBody) {
    return 'El globo de WhatsApp (template de Meta) se transcribe en la Parte I. El contenido certificado mostrado en el lector constituye el texto intimado y se identifica mediante el contentHash consignado en este certificado.';
  }
  if (hasRenderedBody) {
    return 'El globo de WhatsApp (template de Meta) se transcribe en la Parte I como aviso de acceso. El contenido certificado mostrado en el lector constituye el texto intimado y se identifica mediante el contentHash consignado en este certificado.';
  }
  return 'WhatsApp transportó un aviso (template de Meta) con enlace al lector certificado. El contenido certificado mostrado en el lector constituye el texto intimado y se identifica mediante el contentHash consignado en este certificado.';
}
