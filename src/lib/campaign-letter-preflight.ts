import {
  campaignLetterTexts,
  checkLetterVariables,
  describeNumericLetterPlaceholders,
  numericLetterPlaceholders,
} from '@/lib/campaign-letter-fields';
import { loadCampaignRecipientRows } from '@/lib/campaign-wa-preflight';

/**
 * Antes del primer envío: cada {{variable}} del asunto y de la carta tiene que tener dato en todos los destinatarios.
 * La carta se lacra tal como sale; un dato vacío dejaría la frase incompleta en un documento legal.
 * Lanza un error 409 con el detalle si falta algo.
 */
export async function assertCampaignLetterVariables(campaign: Record<string, unknown>): Promise<void> {
  if (campaign.simulated === true) return;
  const texts = campaignLetterTexts(campaign);
  if (!texts.some((t) => t.includes('{{'))) return;
  // {{1}}, {{2}}… son de Meta: la carta no los completa y saldrían a la vista en el lector y en el correo.
  const numeric = numericLetterPlaceholders(texts);
  if (numeric.length) {
    throw Object.assign(new Error(`No se envió: ${describeNumericLetterPlaceholders(numeric)}`), { status: 409 });
  }
  const rows = await loadCampaignRecipientRows(campaign);
  const canal = String(campaign.canal || 'email');
  // En campañas mixtas el correo solo se manda a quien tiene email real; el resto recibe solo WhatsApp.
  const target = canal === 'ambos' ? rows.filter((r) => String(r.email || '').trim()) : rows;
  const check = checkLetterVariables({ texts, rows: target });
  if (!check.ok) {
    throw Object.assign(
      new Error(`No se envió: la carta usa datos que faltan en el CSV. ${check.message} Completá esas columnas y volvé a cargar el archivo.`),
      { status: 409 }
    );
  }
}
