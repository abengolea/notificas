import { getAdminBucket } from '@/lib/firebase-admin';
import { checkWaVariables } from '@/lib/wa-variables-check';
import { WA_DEFAULT_TEMPLATE_NAME, WA_TEMPLATE_DEFAULT_VARS, usesNotificasDefaultTemplate } from '@/lib/wa-template-fields';
import { resolveWaUrlButton } from '@/lib/campaign-mixed-message';
import { checkWaTemplateShape, describeBodyVariableMismatch } from '@/lib/wa-template-shape';
import { fetchApprovedWhatsAppTemplate } from '@/lib/meta-message-templates';
import { getWhatsAppAccessToken } from '@/lib/meta-access-token';
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
 * El template de Meta tiene que existir, estar aprobado y pedir lo mismo que la campaña va a mandar (cantidad de
 * variables del cuerpo y botón). Si no, Meta rechaza cada mensaje con #132000 y la campaña se quema en errores.
 * Sin credenciales de Meta en este entorno no se puede verificar y se deja pasar.
 */
export async function assertWaTemplateMatchesMeta(input: {
  name: string;
  lang: string;
  variables: string[];
  urlButton: boolean;
}): Promise<void> {
  const token = await getWhatsAppAccessToken();
  const wabaId = (process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '').trim();
  if (!token || !wabaId || !input.name.trim()) return;
  const template = await fetchApprovedWhatsAppTemplate({
    accessToken: token,
    wabaId,
    templateName: input.name,
    templateLang: input.lang,
  });
  if (!template) {
    throw Object.assign(
      new Error(
        `No se envió: no encontramos el template «${input.name}» (${input.lang}) aprobado en Meta. Revisá el nombre y el idioma en Template y reintentá.`
      ),
      { status: 409 }
    );
  }
  const check = checkWaTemplateShape({ template, variables: input.variables, urlButton: input.urlButton });
  if (!check.ok) {
    throw Object.assign(
      new Error(`No se envió: el template de WhatsApp no coincide con la campaña y Meta rechazaría los mensajes. ${check.message}`),
      { status: 409 }
    );
  }
}

/**
 * Antes del primer envío: cada {{N}} del template de WhatsApp tiene que tener dato.
 * Si no, Meta rechaza todos los mensajes (131008) y la campaña se quema en errores.
 * Lanza un error 409 con el detalle si falta algo.
 */
export async function assertCampaignWhatsAppVariables(campaign: Record<string, unknown>): Promise<void> {
  const canal = String(campaign.canal || 'email');
  if (canal === 'email' || campaign.simulated === true) return;

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
  // Igual que el worker: en una campaña mixta el modo solo puede apagar el botón, nunca prenderlo.
  const urlButton = resolveWaUrlButton({
    urlButton: tpl.urlButton,
    mixedMode: canal === 'ambos' ? campaign.mixedMode : undefined,
    usesDefaultTemplate: useDefault,
  });

  // Con el BODY guardado en la campaña se revisa sin depender de Meta: un {{N}} sin variable hace que WhatsApp falle
  // y que el correo (cuando lleva el texto de la plantilla) salga con «{{N}}» a la vista.
  const savedBody = String(campaign.waTemplateBody || '').trim();
  if (!useDefault && savedBody) {
    const mismatch = describeBodyVariableMismatch({
      body: savedBody,
      variables,
      urlButton,
      templateName: tpl.name,
    });
    if (mismatch) {
      throw Object.assign(new Error(`No se envió: ${mismatch}`), { status: 409 });
    }
  }

  // Se revisa siempre (también al reintentar errores): el template de Meta pudo cambiar o la campaña quedó mal armada.
  await assertWaTemplateMatchesMeta({
    name: useDefault ? tpl.name.trim() || WA_DEFAULT_TEMPLATE_NAME : tpl.name,
    lang: String(campaign.waTemplateLang || 'es_AR'),
    variables,
    urlButton,
  });

  // Ya arrancó: los datos se validaron en su primer envío.
  if (campaign.waTemplateSeal) return;

  const rows = await loadCampaignRecipientRows(campaign);

  const check = checkWaVariables({ variables, urlButton, rows, onlyWithPhone: canal === 'ambos' });
  if (!check.ok) {
    throw Object.assign(
      new Error(`No se envió: WhatsApp rechaza los mensajes con variables vacías. ${check.message}`),
      { status: 409 }
    );
  }
}
