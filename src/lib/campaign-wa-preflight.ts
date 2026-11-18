import { getAdminBucket } from '@/lib/firebase-admin';
import { checkWaVariables } from '@/lib/wa-variables-check';
import { WA_TEMPLATE_DEFAULT_VARS, usesNotificasDefaultTemplate } from '@/lib/wa-template-fields';
import type { RecipientEntry } from '@/lib/types';

/** Filas del CSV de la campaña: desde Storage (listas grandes) o inline. */
export async function loadCampaignRecipientRows(campaign: Record<string, unknown>): Promise<RecipientEntry[]> {
  let rows: RecipientEntry[] = [];
  const storagePath = typeof campaign.recipientStoragePath === 'string' ? campaign.recipientStoragePath : '';
  if (storagePath) {
    const chunks = typeof campaign.recipientChunkCount === 'number' ? campaign.recipientChunkCount : 0;
    const bucket = getAdminBucket();
    for (let i = 0; i < chunks; i += 1) {
      const [content] = await bucket.file(`${storagePath}/chunk_${i}.json`).download();
      const part = JSON.parse(content.toString('utf-8'));
      if (Array.isArray(part)) rows = rows.concat(part as RecipientEntry[]);
    }
  } else if (Array.isArray(campaign.recipientData)) {
    rows = campaign.recipientData as RecipientEntry[];
  }
  return rows;
}

/**
 * Antes del primer envío: cada {{N}} del template de WhatsApp tiene que tener dato.
 * Si no, Meta rechaza todos los mensajes (131008) y la campaña se quema en errores.
 * Lanza un error 409 con el detalle si falta algo.
 */
export async function assertCampaignWhatsAppVariables(campaign: Record<string, unknown>): Promise<void> {
  const canal = String(campaign.canal || 'email');
  if (canal === 'email' || campaign.simulated === true) return;
  // Ya arrancó: se validó en su primer envío.
  if (campaign.waTemplateSeal) return;

  // Igual que el worker: sin nombre de plantilla se usa la preferida de la empresa (campañas viejas o por API).
  let tpl = {
    name: String(campaign.waTemplateName || ''),
    variables: Array.isArray(campaign.waTemplateVariables) ? (campaign.waTemplateVariables as string[]) : [],
    urlButton: campaign.waUrlButton === true,
  };
  if (!tpl.name.trim()) {
    const { resolvePreferredOrgWaTemplate } = await import('@/lib/resolve-org-wa-template');
    const preferred = await resolvePreferredOrgWaTemplate(String(campaign.orgId || ''));
    if (preferred) {
      tpl = { name: preferred.templateName, variables: preferred.templateVariables, urlButton: preferred.urlButton === true };
    }
  }
  const useDefault = usesNotificasDefaultTemplate(tpl.name);
  const variables = useDefault ? [...WA_TEMPLATE_DEFAULT_VARS] : tpl.variables;
  const urlButton = useDefault ? false : tpl.urlButton;

  const rows = await loadCampaignRecipientRows(campaign);

  const check = checkWaVariables({ variables, urlButton, rows, onlyWithPhone: canal === 'ambos' });
  if (!check.ok) {
    throw Object.assign(
      new Error(`No se envió: WhatsApp rechaza los mensajes con variables vacías. ${check.message}`),
      { status: 409 }
    );
  }
}
