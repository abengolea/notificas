import { FieldValue } from 'firebase-admin/firestore';
import { WA_DEFAULT_TEMPLATE_NAME, usesNotificasDefaultTemplate } from '@/lib/wa-template-fields';
import {
  effectiveMixedDeliveryMode,
  isMixedDeliveryMode,
  resolveWaUrlButton,
} from '@/lib/campaign-mixed-message';

export function whatsappTemplateCampaignPatch(input: {
  waTemplateName: string;
  waTemplateLang: string;
  waTemplateVariables: string[];
  waUrlButton: boolean;
  waTemplateBody?: string | null;
  /** Campaña mixta: si viene, manda sobre `waUrlButton`. */
  mixedMode?: string | null;
}): Record<string, unknown> {
  const name = input.waTemplateName.trim();
  const useDefault = usesNotificasDefaultTemplate(name);
  const mixedMode = isMixedDeliveryMode(input.mixedMode)
    ? effectiveMixedDeliveryMode(input.mixedMode, useDefault)
    : undefined;
  const waUrlButton = resolveWaUrlButton({
    urlButton: input.waUrlButton,
    mixedMode,
    usesDefaultTemplate: useDefault,
  });
  const patch: Record<string, unknown> = {
    // Elegir la plantilla de Notificas se guarda con su nombre explícito: un nombre vacío significa
    // «sin elegir» y el worker lo reemplaza por otra plantilla guardada de la empresa.
    waTemplateName: useDefault ? (name ? WA_DEFAULT_TEMPLATE_NAME : '') : name,
    waTemplateLang: input.waTemplateLang.trim() || 'es_AR',
    waTemplateVariables: useDefault ? [] : input.waTemplateVariables.map((v) => v.trim()).filter(Boolean),
    waUrlButton,
    ...(mixedMode ? { mixedMode } : {}),
    waTemplateSeal: FieldValue.delete(),
    updatedAt: FieldValue.serverTimestamp(),
  };
  if (useDefault) {
    patch.waTemplateBody = FieldValue.delete();
  } else if (typeof input.waTemplateBody === 'string') {
    patch.waTemplateBody = input.waTemplateBody.trim();
  }
  return patch;
}
