import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';
import { denyOrgMemberWriteOnAdminCampaign, resolveCampaignOrgAccess } from '@/lib/campaign-access';
import { getAdminDb } from '@/lib/firebase-admin';

const bodySchema = z.object({
  campaignId: z.string().min(1),
  orgId: z.string().min(1),
  tandaSize: z.number().int().min(1).max(1_000_000),
});

/** Actualiza el tope diario de los próximos días (el lote de hoy no se mueve). */
export async function POST(request: NextRequest) {
  try {
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const { campaignId, orgId, tandaSize } = parsed.data;
    const access = await resolveCampaignOrgAccess(request, orgId, campaignId);
    if (!access.ok) return access.response;

    const db = getAdminDb();
    const ref = db.collection('campaigns').doc(campaignId);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ error: 'Campaña no encontrada' }, { status: 404 });
    const blocked = denyOrgMemberWriteOnAdminCampaign(access, snap.data());
    if (blocked) return blocked;
    const estado = String(snap.data()?.estado || '');
    if (estado === 'cancelada' || estado === 'completada') {
      return NextResponse.json({ error: 'Esta campaña ya no admite cambio de cupo' }, { status: 400 });
    }

    await ref.update({
      tandaSize,
      updatedAt: FieldValue.serverTimestamp(),
    });
    return NextResponse.json({ ok: true, tandaSize });
  } catch (e: unknown) {
    console.error('POST /api/campaigns/quota', e);
    return NextResponse.json({ error: 'Error al guardar el tope diario' }, { status: 500 });
  }
}
