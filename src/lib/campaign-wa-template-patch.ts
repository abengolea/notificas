import { FieldValue } from 'firebase-admin/firestore';
import { usesNotificasDefaultTemplate } from '@/lib/wa-template-fields';
import {
  effectiveMixedDeliveryMode,
  isMixedDeliveryMode,
  mixedModeWhatsAppUsesReader,
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
  const waUrlButton = useDefault
    ? false
    : mixedMode
      ? mixedModeWhatsAppUsesReader(mixedMode)
      : input.waUrlButton === true;
  const patch: Record<string, unknown> = {
    waTemplateName: useDefault ? '' : name,
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
