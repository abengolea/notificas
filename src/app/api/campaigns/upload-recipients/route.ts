import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { verifyAuthToken } from '@/lib/auth-helper';
import { getAdminDb, getAdminBucket } from '@/lib/firebase-admin';
import { getOrgIfMember } from '@/lib/org-server';
import type { RecipientEntry } from '@/lib/types';

const CHUNK_SIZE = 500;

export async function POST(request: NextRequest) {
  try {
    const { decoded, errorResponse } = await verifyAuthToken(request);
    if (errorResponse) return errorResponse;

    const body = await request.json() as {
      campaignId: string;
      orgId: string;
      recipients: RecipientEntry[];
    };
    const { campaignId, orgId, recipients } = body;

    if (!campaignId || !orgId || !Array.isArray(recipients) || recipients.length === 0) {
      return NextResponse.json({ error: 'Parámetros requeridos: campaignId, orgId, recipients' }, { status: 400 });
    }

    const orgGate = await getOrgIfMember(decoded!.uid, orgId, decoded!.email);
    if (!orgGate) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

    const db = getAdminDb();
    const campSnap = await db.collection('campaigns').doc(campaignId).get();
    if (!campSnap.exists || String(campSnap.data()!.orgId) !== orgId) {
      return NextResponse.json({ error: 'Campaña no encontrada' }, { status: 404 });
    }

    const bucket = getAdminBucket();
    const basePath = `campaign-recipients/${orgId}/${campaignId}`;
    const chunkCount = Math.ceil(recipients.length / CHUNK_SIZE);

    // Upload chunks in parallel (up to 10 concurrent)
    const CONCURRENT = 10;
    for (let i = 0; i < chunkCount; i += CONCURRENT) {
      const batch = Array.from({ length: Math.min(CONCURRENT, chunkCount - i) }, (_, j) => {
        const idx = i + j;
        const chunk = recipients.slice(idx * CHUNK_SIZE, (idx + 1) * CHUNK_SIZE);
        const file = bucket.file(`${basePath}/chunk_${idx}.json`);
        return file.save(JSON.stringify(chunk), { contentType: 'application/json', resumable: false });
      });
      await Promise.all(batch);
    }

    await db.collection('campaigns').doc(campaignId).update({
      recipientStoragePath: basePath,
      recipientChunkCount: chunkCount,
      recipientCount: recipients.length,
      // Limpiamos los campos inline para no superar el límite de 1MB del doc
      recipientData: FieldValue.delete(),
      recipientEmails: FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ ok: true, recipientCount: recipients.length, chunkCount });
  } catch (e) {
    console.error('POST /api/campaigns/upload-recipients', e);
    return NextResponse.json({ error: 'Error al subir destinatarios' }, { status: 500 });
  }
}
