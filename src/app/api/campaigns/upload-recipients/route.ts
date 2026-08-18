import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken } from '@/lib/auth-helper';
import { getAdminDb } from '@/lib/firebase-admin';
import { getOrgIfMember } from '@/lib/org-server';
import { RECIPIENT_CHUNK_SIZE } from '@/lib/campaign-recipients';
import {
  finalizeRecipientUpload,
  saveAllRecipientChunks,
  saveRecipientChunk,
} from '@/lib/campaign-recipients-storage';
import type { RecipientEntry } from '@/lib/types';
import { isUnsentCampaign, UNSENT_EDIT_ERROR } from '@/lib/campaign-edit';

type UploadBody = {
  campaignId?: string;
  orgId?: string;
  recipients?: RecipientEntry[];
  chunkIndex?: number;
  finalize?: boolean;
  chunkCount?: number;
  recipientCount?: number;
};

export async function POST(request: NextRequest) {
  try {
    const { decoded, errorResponse } = await verifyAuthToken(request);
    if (errorResponse) return errorResponse;

    const body = (await request.json()) as UploadBody;
    const { campaignId, orgId } = body;

    if (!campaignId || !orgId) {
      return NextResponse.json({ error: 'Parámetros requeridos: campaignId, orgId' }, { status: 400 });
    }

    const orgGate = await getOrgIfMember(decoded!.uid, orgId, decoded!.email);
    if (!orgGate) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

    const db = getAdminDb();
    const campSnap = await db.collection('campaigns').doc(campaignId).get();
    if (!campSnap.exists || String(campSnap.data()!.orgId) !== orgId) {
      return NextResponse.json({ error: 'Campaña no encontrada' }, { status: 404 });
    }
    if (!isUnsentCampaign(campSnap.data() || {})) {
      return NextResponse.json({ error: UNSENT_EDIT_ERROR }, { status: 409 });
    }

    if (body.finalize === true) {
      const chunkCount = Number(body.chunkCount);
      const recipientCount = Number(body.recipientCount);
      if (!Number.isInteger(chunkCount) || chunkCount < 1 || !Number.isInteger(recipientCount) || recipientCount < 1) {
        return NextResponse.json(
          { error: 'finalize requiere chunkCount y recipientCount válidos' },
          { status: 400 }
        );
      }
      try {
        await finalizeRecipientUpload(orgId, campaignId, chunkCount, recipientCount);
        await db.collection('campaigns').doc(campaignId).update({
          'stats.total': recipientCount,
          'stats.pendientes': recipientCount,
          'stats.enviados': 0,
          'stats.leidos': 0,
          'stats.errores': 0,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Error al finalizar subida';
        return NextResponse.json({ error: msg }, { status: 400 });
      }
      return NextResponse.json({ ok: true, recipientCount, chunkCount, finalized: true });
    }

    const recipients = body.recipients;
    if (!Array.isArray(recipients) || recipients.length === 0) {
      return NextResponse.json({ error: 'Parámetros requeridos: campaignId, orgId, recipients' }, { status: 400 });
    }

    if (typeof body.chunkIndex === 'number') {
      if (!Number.isInteger(body.chunkIndex) || body.chunkIndex < 0) {
        return NextResponse.json({ error: 'chunkIndex inválido' }, { status: 400 });
      }
      if (recipients.length > RECIPIENT_CHUNK_SIZE) {
        return NextResponse.json(
          { error: `Máximo ${RECIPIENT_CHUNK_SIZE} destinatarios por chunk` },
          { status: 400 }
        );
      }
      await saveRecipientChunk(orgId, campaignId, body.chunkIndex, recipients);
      return NextResponse.json({ ok: true, chunkIndex: body.chunkIndex, count: recipients.length });
    }

    const saved = await saveAllRecipientChunks(orgId, campaignId, recipients);
    return NextResponse.json({ ok: true, ...saved });
  } catch (e) {
    console.error('POST /api/campaigns/upload-recipients', e);
    return NextResponse.json({ error: 'Error al subir destinatarios' }, { status: 500 });
  }
}
