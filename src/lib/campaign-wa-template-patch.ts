import { FieldValue } from 'firebase-admin/firestore';
import { usesNotificasDefaultTemplate } from '@/lib/wa-template-fields';

export function whatsappTemplateCampaignPatch(input: {
  waTemplateName: string;
  waTemplateLang: string;
  waTemplateVariables: string[];
  waUrlButton: boolean;
}): Record<string, unknown> {
  const name = input.waTemplateName.trim();
  const useDefault = usesNotificasDefaultTemplate(name);
  return {
    waTemplateName: useDefault ? '' : name,
    waTemplateLang: input.waTemplateLang.trim() || 'es_AR',
    waTemplateVariables: useDefault ? [] : input.waTemplateVariables.map((v) => v.trim()).filter(Boolean),
    waUrlButton: useDefault ? false : input.waUrlButton === true,
    waTemplateSeal: FieldValue.delete(),
    updatedAt: FieldValue.serverTimestamp(),
  };
}
