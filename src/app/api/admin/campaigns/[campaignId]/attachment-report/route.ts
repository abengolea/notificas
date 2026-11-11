import { NextRequest, NextResponse } from 'next/server';
import { assertAdminSession } from '@/lib/assert-admin-session';
import { buildCampaignAttachmentReport, listCampaignAttachmentFileNames } from '@/lib/campaign-attachment-files';

/** Cruza la columna `adjunto` de la lista guardada con los archivos ya subidos a la campaña. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  const denied = assertAdminSession(request);
  if (denied) return denied;

  try {
    const { campaignId } = await params;
    const [report, fileNames] = await Promise.all([
      buildCampaignAttachmentReport(campaignId),
      listCampaignAttachmentFileNames(campaignId),
    ]);
    // `fileNames`: el wizard los suma a los archivos nuevos para mostrar la coincidencia completa al editar.
    return NextResponse.json({ report, fileNames });
  } catch (e) {
    console.error('GET /api/admin/campaigns/[id]/attachment-report', e);
    return NextResponse.json({ error: 'No se pudo armar el informe de adjuntos' }, { status: 500 });
  }
}
