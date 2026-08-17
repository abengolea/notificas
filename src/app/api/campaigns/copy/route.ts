import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { resolveCampaignOrgAccess } from '@/lib/campaign-access';
import { getAdminDb, getAdminBucket } from '@/lib/firebase-admin';
import type { RecipientEntry } from '@/lib/types';

const CHUNK_SIZE = 500;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { campaignId: string; orgId: string };
    const { campaignId, orgId } = body;
    if (!campaignId || !orgId) {
      return NextResponse.json({ error: 'campaignId y orgId son requeridos' }, { status: 400 });
    }

    const access = await resolveCampaignOrgAccess(request, orgId, campaignId);
    if (!access.ok) return access.response;

    const db = getAdminDb();
    const src = await db.collection('campaigns').doc(campaignId).get();
    if (!src.exists || String(src.data()!.orgId) !== orgId) {
      return NextResponse.json({ error: 'Campaña no encontrada' }, { status: 404 });
    }

    const c = src.data()!;
    const orgSnap = await db.collection('organizations').doc(orgId).get();
    const createdBy = access.viaAdmin
      ? String(orgSnap.data()?.adminUserId || c.createdBy || '')
      : String(access.uid || '');
    const nombre = `Copia de ${c.nombre}`;

    // Crear el documento de la nueva campaña (sin destinatarios aún)
    const newRef = await db.collection('campaigns').add({
      orgId,
      createdBy,
      senderEmail: c.senderEmail ?? null,
      senderUid: createdBy || null,
      nombre,
      asunto:  c.asunto  ?? '',
      cuerpo:  c.cuerpo  ?? '',
      canal:   c.canal   ?? 'email',
      adjuntos: c.adjuntos ?? [],
      ...(c.adjuntosPorDestinatario ? { adjuntosPorDestinatario: c.adjuntosPorDestinatario } : {}),
      ...(c.waTemplateName       ? { waTemplateName:       c.waTemplateName }       : {}),
      ...(c.waTemplateLang       ? { waTemplateLang:       c.waTemplateLang }       : {}),
      ...(c.waTemplateVariables  ? { waTemplateVariables:  c.waTemplateVariables }  : {}),
      recipientCount: c.recipientCount ?? 0,
      stats: {
        total:     c.recipientCount ?? 0,
        enviados:  0,
        leidos:    0,
        errores:   0,
        pendientes: c.recipientCount ?? 0,
      },
      estado: 'borrador',
      createdAt: FieldValue.serverTimestamp(),
      ...(access.viaAdmin || c.managedByAdmin ? { managedByAdmin: true } : {}),
      ...(c.simulated === true ? { simulated: true } : {}),
      ...(typeof c.tandaSize === 'number' ? { tandaSize: c.tandaSize } : {}),
    });

    // Copiar destinatarios desde Storage
    const bucket = getAdminBucket();
    const srcPath = c.recipientStoragePath as string | undefined;

    if (srcPath) {
      const chunkCount = typeof c.recipientChunkCount === 'number' ? c.recipientChunkCount : 1;
      const recipients: RecipientEntry[] = [];

      for (let i = 0; i < chunkCount; i++) {
        const [content] = await bucket.file(`${srcPath}/chunk_${i}.json`).download();
        const chunk = JSON.parse(content.toString('utf-8')) as RecipientEntry[];
        recipients.push(...chunk);
      }

      // Re-subir al path del nuevo campaignId
      const destPath = `campaign-recipients/${orgId}/${newRef.id}`;
      const newChunkCount = Math.ceil(recipients.length / CHUNK_SIZE);
      const CONCURRENT = 10;
      for (let i = 0; i < newChunkCount; i += CONCURRENT) {
        await Promise.all(
          Array.from({ length: Math.min(CONCURRENT, newChunkCount - i) }, (_, j) => {
            const idx = i + j;
            const chunk = recipients.slice(idx * CHUNK_SIZE, (idx + 1) * CHUNK_SIZE);
            return bucket
              .file(`${destPath}/chunk_${idx}.json`)
              .save(JSON.stringify(chunk), { contentType: 'application/json', resumable: false });
          })
        );
      }

      await newRef.update({
        recipientStoragePath: destPath,
        recipientChunkCount:  newChunkCount,
        recipientCount:       recipients.length,
      });
    } else if (Array.isArray(c.recipientData) && c.recipientData.length > 0) {
      // Campaña antigua con datos inline — subirlos a Storage
      const recipients = c.recipientData as RecipientEntry[];
      const destPath   = `campaign-recipients/${orgId}/${newRef.id}`;
      const newChunkCount = Math.ceil(recipients.length / CHUNK_SIZE);
      for (let i = 0; i < newChunkCount; i++) {
        const chunk = recipients.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
        await bucket
          .file(`${destPath}/chunk_${i}.json`)
          .save(JSON.stringify(chunk), { contentType: 'application/json', resumable: false });
      }
      await newRef.update({
        recipientStoragePath: destPath,
        recipientChunkCount:  newChunkCount,
        recipientCount:       recipients.length,
      });
    }

    return NextResponse.json({ ok: true, newCampaignId: newRef.id, nombre });
  } catch (e: unknown) {
    console.error('POST /api/campaigns/copy', e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error interno' }, { status: 500 });
  }
}
