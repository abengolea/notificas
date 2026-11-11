import { createHash, randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { assertAdminSession } from '@/lib/assert-admin-session';
import { getAdminBucket, getAdminDb } from '@/lib/firebase-admin';
import { isUnsentCampaign, UNSENT_EDIT_ERROR } from '@/lib/campaign-edit';
import { CAMPAIGN_ATTACHMENT_MAX_BYTES, CAMPAIGN_ATTACHMENT_MAX_MB } from '@/lib/campaign-attachment-payload';
import { attachmentFileDocId, saveCampaignAttachmentFile } from '@/lib/campaign-attachment-files';
import type { CampaignAttachment } from '@/lib/types';

/**
 * El panel admin no tiene sesión de Firebase Auth en el navegador, así que no puede subir a Storage
 * directo (las reglas piden request.auth). El archivo pasa por acá y se guarda con el Admin SDK.
 * Devuelve el mismo formato que usa el envío de empresa: nombre, url, hash SHA-256 y tamaño.
 */
function safeFileName(name: string): string {
  const cleaned = name.replace(/[\\/]/g, '_').replace(/[^\w.\- ()]/g, '_').trim();
  return cleaned.slice(-120) || 'adjunto';
}

export async function POST(request: NextRequest) {
  const denied = assertAdminSession(request);
  if (denied) return denied;

  try {
    const form = await request.formData();
    const campaignId = String(form.get('campaignId') || '').trim();
    const file = form.get('file');
    if (!campaignId) {
      return NextResponse.json({ error: 'Parámetro requerido: campaignId' }, { status: 400 });
    }
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Archivo requerido' }, { status: 400 });
    }
    if (file.size <= 0 || file.size > CAMPAIGN_ATTACHMENT_MAX_BYTES) {
      return NextResponse.json(
        { error: `Cada adjunto debe pesar entre 1 byte y ${CAMPAIGN_ATTACHMENT_MAX_MB} MB` },
        { status: 400 }
      );
    }

    const snap = await getAdminDb().collection('campaigns').doc(campaignId).get();
    if (!snap.exists) {
      return NextResponse.json({ error: 'Campaña no encontrada' }, { status: 404 });
    }
    if (!isUnsentCampaign(snap.data() || {})) {
      return NextResponse.json({ error: UNSENT_EDIT_ERROR }, { status: 409 });
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const hash = createHash('sha256').update(bytes).digest('hex');
    const nombre = file.name || 'adjunto';
    // Adjunto por columna: el archivo se busca después por su nombre, así que se registra aparte.
    const byColumn = String(form.get('mode') || '') === 'column';
    const bucket = getAdminBucket();
    const path = byColumn
      ? `pdfs/admin/${campaignId}/files/${attachmentFileDocId(nombre)}_${safeFileName(nombre)}`
      : `pdfs/admin/${campaignId}/${Date.now()}_${safeFileName(nombre)}`;
    const token = randomUUID();

    await bucket.file(path).save(bytes, {
      resumable: false,
      contentType: file.type || 'application/octet-stream',
      metadata: {
        metadata: {
          firebaseStorageDownloadTokens: token,
          campaignId,
          originalName: nombre,
          sha256: hash,
          uploadedAt: new Date().toISOString(),
        },
      },
    });

    const url = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(path)}?alt=media&token=${token}`;
    const attachment: CampaignAttachment = { nombre, url, hash, size: file.size };
    if (byColumn) await saveCampaignAttachmentFile(campaignId, attachment, path);
    return NextResponse.json({ ok: true, attachment });
  } catch (e) {
    console.error('POST /api/admin/campaigns/upload-attachment', e);
    return NextResponse.json({ error: 'Error al subir el adjunto' }, { status: 500 });
  }
}
