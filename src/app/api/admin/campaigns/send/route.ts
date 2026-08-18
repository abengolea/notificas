import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { assertAdminSession } from '@/lib/assert-admin-session';
import { startCampaignTanda } from '@/lib/campaign-start-tanda';

const bodySchema = z.object({
  campaignId: z.string().min(1),
  tandaSize: z.number().int().min(0).optional(),
  retryErrors: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  const denied = assertAdminSession(request);
  if (denied) return denied;

  try {
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const result = await startCampaignTanda({
      campaignId: parsed.data.campaignId,
      upcomingQuota: parsed.data.tandaSize,
      retryErrors: parsed.data.retryErrors,
      requireStorage: true,
      chargeCredits: false,
    });
    return NextResponse.json(result);
  } catch (e: unknown) {
    console.error('POST /api/admin/campaigns/send', e);
    const msg = e instanceof Error ? e.message : 'Error interno';
    const status = typeof (e as { status?: number }).status === 'number' ? (e as { status: number }).status : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
