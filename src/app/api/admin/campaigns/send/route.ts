import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { assertAdminSession } from '@/lib/assert-admin-session';
import { startCampaignTanda } from '@/lib/campaign-start-tanda';
import { getAdminDb } from '@/lib/firebase-admin';
import { buildCampaignAttachmentReport } from '@/lib/campaign-attachment-files';
import { describeAttachmentReportProblem } from '@/lib/campaign-attachment-name';

const bodySchema = z.object({
  campaignId: z.string().min(1),
  tandaSize: z.number().int().min(0).optional(),
  retryErrors: z.boolean().optional(),
  exceedDailyQuota: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  const denied = assertAdminSession(request);
  if (denied) return denied;

  try {
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    // Adjunto por columna: no se arranca si alguien se quedaría sin su archivo.
    const campSnap = await getAdminDb().collection('campaigns').doc(parsed.data.campaignId).get();
    const camp = campSnap.data();
    if (camp && camp.attachmentsByColumn === true && camp.simulated !== true) {
      const report = await buildCampaignAttachmentReport(parsed.data.campaignId);
      const problem = describeAttachmentReportProblem(report);
      if (problem) {
        return NextResponse.json(
          { error: `No se envió: ${problem} Subí los archivos que faltan o corregí la columna «adjunto» y probá de nuevo.`, report },
          { status: 409 }
        );
      }
    }

    const result = await startCampaignTanda({
      campaignId: parsed.data.campaignId,
      upcomingQuota: parsed.data.tandaSize,
      retryErrors: parsed.data.retryErrors,
      exceedDailyQuota: parsed.data.exceedDailyQuota,
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
