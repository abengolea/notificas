import type { CampaignAttachment, RecipientEntry } from '@/lib/types';

export const CAMPAIGN_ATTACHMENT_MAX_MB = 10;
export const CAMPAIGN_ATTACHMENT_MAX_BYTES = CAMPAIGN_ATTACHMENT_MAX_MB * 1024 * 1024;

export interface CampaignAttachmentFields {
  /** Adjuntos que van a todos los destinatarios (vacío cuando hay emparejamiento). */
  adjuntosGlobales: CampaignAttachment[];
  /** email (minúsculas) → su archivo. `undefined` si no hay emparejamiento. */
  adjuntosPorDestinatario?: Record<string, CampaignAttachment[]>;
}

/**
 * Arma los campos de adjuntos que se guardan en la campaña.
 * Lo comparten el envío de empresa y el de admin para que ambos interpreten igual el emparejamiento.
 */
export function buildCampaignAttachmentFields(params: {
  existingAttachments: CampaignAttachment[];
  uploadedNew: CampaignAttachment[];
  existingPaired: Record<string, CampaignAttachment[]> | null;
  pairByRecipient: boolean;
  recipients: RecipientEntry[];
  /** email (minúsculas) → índice dentro de `uploadedNew`, o null si no tiene archivo. */
  pairingSelections: Record<string, number | null>;
}): CampaignAttachmentFields {
  const { existingAttachments, uploadedNew, existingPaired, pairByRecipient, recipients, pairingSelections } = params;
  const uploaded = [...existingAttachments, ...uploadedNew];

  const pairingActive = pairByRecipient && uploadedNew.length > 0;
  const keepExistingPairing = Boolean(existingPaired) && uploadedNew.length === 0 && pairByRecipient;

  if (pairingActive) {
    const porDestinatario: Record<string, CampaignAttachment[]> = {};
    recipients.forEach((r) => {
      const k = r.email.trim().toLowerCase();
      const idx = pairingSelections[k];
      const one = typeof idx === 'number' ? uploadedNew[idx] : undefined;
      porDestinatario[k] = one
        ? [{ nombre: one.nombre, url: one.url, hash: one.hash || '', size: one.size }]
        : [];
    });
    return { adjuntosGlobales: [], adjuntosPorDestinatario: porDestinatario };
  }

  if (keepExistingPairing && existingPaired) {
    return { adjuntosGlobales: [], adjuntosPorDestinatario: existingPaired };
  }

  return { adjuntosGlobales: uploaded };
}
