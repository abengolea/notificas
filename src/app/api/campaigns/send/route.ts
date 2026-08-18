import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken } from '@/lib/auth-helper';
import { getAdminDb } from '@/lib/firebase-admin';
import { getOrgIfMember, maxRecipientsForPlan } from '@/lib/org-server';
import { startCampaignTanda } from '@/lib/campaign-start-tanda';
import { z } from 'zod';

const bodySchema = z.object({
  campaignId: z.string().min(1),
  orgId: z.string().min(1),
  retryErrors: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const { decoded, errorResponse } = await verifyAuthToken(request);
    if (errorResponse) return errorResponse;
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Authorization Bearer requerido' }, { status: 401 });
    }

    const jsonBody = await request.json();
    const parsed = bodySchema.safeParse(jsonBody);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const db = getAdminDb();
    const uid = decoded!.uid;

    const orgGate = await getOrgIfMember(uid, parsed.data.orgId, decoded!.email);
    if (!orgGate) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

    const campSnap = await db.collection('campaigns').doc(parsed.data.campaignId).get();
    if (!campSnap.exists) return NextResponse.json({ error: 'Campaña no encontrada' }, { status: 404 });
    const campaign = campSnap.data()!;
    if (String(campaign.orgId) !== parsed.data.orgId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const plan = String(orgGate.data.plan || 'starter');
    const result = await startCampaignTanda({
      campaignId: parsed.data.campaignId,
      retryErrors: parsed.data.retryErrors,
      actorUid: uid,
      actorEmail: decoded!.email || '',
      requireStorage: Boolean(campaign.recipientStoragePath),
      chargeCredits: true,
      maxRecipients: maxRecipientsForPlan(plan),
    });

    return NextResponse.json({
      ...result,
      pending: result.queued ? result.pendingThisTanda : 0,
    });
  } catch (e: unknown) {
    console.error('POST /api/campaigns/send', e);
    const msg = e instanceof Error ? e.message : 'Error interno';
    const status = typeof (e as { status?: number }).status === 'number' ? (e as { status: number }).status : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
