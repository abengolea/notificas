import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { resolveCampaignOrgAccess } from '@/lib/campaign-access';
import { getAdminDb } from '@/lib/firebase-admin';
import { canEditWhatsAppTemplate, WA_TEMPLATE_EDIT_ERROR } from '@/lib/campaign-edit';
import { whatsappTemplateCampaignPatch } from '@/lib/campaign-wa-template-patch';

const bodySchema = z.object({
  campaignId: z.string().min(1),
  orgId: z.string().min(1),
  waTemplateName: z.string().max(128),
  waTemplateLang: z.string().max(16),
  waTemplateVariables: z.array(z.string().max(200)).max(10),
  waUrlButton: z.boolean(),
});

export async function POST(request: NextRequest) {
  try {
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { campaignId, orgId } = parsed.data;
    const access = await resolveCampaignOrgAccess(request, orgId, campaignId);
    if (!access.ok) return access.response;

    const db = getAdminDb();
    const ref = db.collection('campaigns').doc(campaignId);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: 'Campaña no encontrada' }, { status: 404 });
    }

    const current = snap.data()!;
    if (String(current.canal || 'email') === 'email') {
      return NextResponse.json({ error: 'Esta campaña no usa WhatsApp' }, { status: 400 });
    }
    if (!canEditWhatsAppTemplate(current)) {
      return NextResponse.json({ error: WA_TEMPLATE_EDIT_ERROR }, { status: 409 });
    }

    await ref.update(
      whatsappTemplateCampaignPatch({
        waTemplateName: parsed.data.waTemplateName,
        waTemplateLang: parsed.data.waTemplateLang,
        waTemplateVariables: parsed.data.waTemplateVariables,
        waUrlButton: parsed.data.waUrlButton,
      })
    );

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('POST /api/campaigns/wa-template', e);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
