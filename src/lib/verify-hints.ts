export type IssuedDocKind =
  | 'campaign_report'
  | 'campaign_acta'
  | 'campaign_acta_recipient'
  | 'mail_certificate'
  | 'campaign_export';

export type VerifyHints = {
  kind?: IssuedDocKind;
  campaignId?: string;
  campaignNombre?: string;
  batchId?: string;
  messageId?: string;
};

export function campaignVerifyRef(
  kind: IssuedDocKind,
  campaignId: string,
  extra?: string
): string {
  return extra ? `ntf:${kind}:${campaignId}:${extra}` : `ntf:${kind}:${campaignId}`;
}

export function formatVerifyRefLine(ref: string): string {
  return `verify-ref: ${ref}`;
}

function asKind(raw: string): IssuedDocKind | undefined {
  if (
    raw === 'campaign_report' ||
    raw === 'campaign_acta' ||
    raw === 'campaign_acta_recipient' ||
    raw === 'mail_certificate' ||
    raw === 'campaign_export'
  ) {
    return raw;
  }
  return undefined;
}

/** Extrae IDs de un PDF de Notificas (texto literal de jsPDF) o del nombre de archivo. */
export function extractVerifyHints(source: ArrayBuffer | string, fileName?: string): VerifyHints {
  const text = typeof source === 'string' ? source : new TextDecoder('latin1').decode(source);
  const hints: VerifyHints = {};

  const ref = text.match(
    /verify-ref:\s*ntf:([a-z_]+):([A-Za-z0-9_-]+)(?::([A-Za-z0-9_-]+))?/i
  );
  if (ref) {
    hints.kind = asKind(ref[1]);
    hints.campaignId = ref[2];
    if (hints.kind === 'campaign_acta') hints.batchId = ref[3];
    if (hints.kind === 'campaign_acta_recipient') {
      hints.messageId = ref[3];
    }
    if (hints.kind === 'mail_certificate') {
      hints.messageId = ref[3] || ref[2];
      if (!ref[3] || ref[2] === 'mail') {
        hints.campaignId = undefined;
      }
    }
  }

  const camp = text.match(/ID campa(?:ña|na):\s*([A-Za-z0-9_-]{8,})/i);
  if (camp && !hints.campaignId) hints.campaignId = camp[1];

  const campName = text.match(/Campa(?:ña|na):\s*([^\n\r)]+)/);
  if (campName) {
    const nombre = campName[1].replace(/\s+/g, " ").trim();
    if (nombre.length >= 4) hints.campaignNombre = nombre;
  }

  const tanda = text.match(/Tanda:\s*([A-Za-z0-9_-]+)/);
  if (tanda && !hints.batchId) hints.batchId = tanda[1];

  if (fileName) {
    const actaDest = fileName.match(/^acta-destinatario-([^.]+)\.pdf$/i);
    if (actaDest) hints.messageId = hints.messageId || actaDest[1];

    const actaTanda = fileName.match(/^acta-tanda-([A-Za-z0-9_-]+)-([A-Za-z0-9_-]+)\.pdf$/i);
    if (actaTanda) {
      hints.campaignId = hints.campaignId || actaTanda[1];
      hints.batchId = hints.batchId || actaTanda[2];
      hints.kind = hints.kind || 'campaign_acta';
    }

    const reporte = fileName.match(/^reporte(?:-[a-z0-9]+)*-([A-Za-z0-9_-]{16,})\.pdf$/i);
    if (reporte) {
      hints.campaignId = hints.campaignId || reporte[1];
      hints.kind = hints.kind || 'campaign_report';
    }

    const lectura = fileName.match(/^certificado-lectura-([^.]+)\.pdf$/i);
    if (lectura) hints.messageId = hints.messageId || lectura[1];
  }

  return hints;
}
