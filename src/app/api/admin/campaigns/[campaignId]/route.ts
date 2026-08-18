import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';
import { assertAdminSession } from '@/lib/assert-admin-session';
import { getAdminDb } from '@/lib/firebase-admin';
import { normalizeEnviosDisponibles } from '@/lib/envios';
import { isUnsentCampaign, UNSENT_EDIT_ERROR } from '@/lib/campaign-edit';
import type { CanalCampaign } from '@/lib/types';

const patchSchema = z.object({
  nombre: z.string().min(2).max(200).optional(),
  asunto: z.string().min(1).max(300).optional(),
  cuerpo: z.string().min(1).max(20000).optional(),
  canal: z.enum(['email', 'whatsapp', 'ambos']).optional(),
  waTemplateName: z.string().max(128).optional(),
  waTemplateLang: z.string().max(16).optional(),
  waTemplateVariables: z.array(z.string().max(40)).max(8).optional(),
  waUrlButton: z.boolean().optional(),
  tandaSize: z.number().int().min(0).optional(),
});

function serializeCampaign(id: string, data: FirebaseFirestore.DocumentData) {
  return {
    id,
    orgId: String(data.orgId || ''),
    createdBy: String(data.createdBy || ''),
    nombre: String(data.nombre || ''),
    asunto: String(data.asunto || ''),
    cuerpo: String(data.cuerpo || ''),
    canal: String(data.canal || 'email'),
    estado: String(data.estado || 'borrador'),
    recipientCount: typeof data.recipientCount === 'number' ? data.recipientCount : 0,
    recipientChunkCount: typeof data.recipientChunkCount === 'number' ? data.recipientChunkCount : 0,
    recipientStoragePath: typeof data.recipientStoragePath === 'string' ? data.recipientStoragePath : '',
    tandaSize: typeof data.tandaSize === 'number' ? data.tandaSize : 0,
    waTemplateName: String(data.waTemplateName || ''),
    waTemplateLang: String(data.waTemplateLang || 'es_AR'),
    waTemplateVariables: Array.isArray(data.waTemplateVariables) ? data.waTemplateVariables : [],
    waUrlButton: data.waUrlButton === true,
    managedByAdmin: data.managedByAdmin === true,
    simulated: data.simulated === true,
    senderUid: String(data.senderUid || ''),
    senderEmail: String(data.senderEmail || ''),
    stats: {
      total: data.stats?.total ?? 0,
      enviados: data.stats?.enviados ?? 0,
      leidos: data.stats?.leidos ?? 0,
      pendientes: data.stats?.pendientes ?? 0,
      errores: data.stats?.errores ?? 0,
    },
    createdAt: data.createdAt?.toDate?.()?.toISOString?.() ?? null,
    startedAt: data.startedAt?.toDate?.()?.toISOString?.() ?? null,
    completedAt: data.completedAt?.toDate?.()?.toISOString?.() ?? null,
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  const denied = assertAdminSession(request);
  if (denied) return denied;

  try {
    const { campaignId } = await params;
    const db = getAdminDb();
    const snap = await db.collection('campaigns').doc(campaignId).get();
    if (!snap.exists) {
      return NextResponse.json({ error: 'Campaña no encontrada' }, { status: 404 });
    }
    const data = snap.data()!;
    const orgSnap = await db.collection('organizations').doc(String(data.orgId)).get();
    const org = orgSnap.data() || {};
    const senderUid = String(data.senderUid || data.createdBy || org.adminUserId || '');
    const userSnap = senderUid ? await db.collection('users').doc(senderUid).get() : null;
    const creditos = normalizeEnviosDisponibles(userSnap?.data()?.creditos);

    const successSnap = await db
      .collection('campaign_messages')
      .where('campaignId', '==', campaignId)
      .where('estado', 'in', ['enviado', 'leido'])
      .count()
      .get();

    return NextResponse.json({
      campaign: serializeCampaign(snap.id, data),
      org: {
        id: orgSnap.id,
        nombre: String(org.nombre || ''),
        plan: String(org.plan || 'starter'),
        adminUserEmail: String(org.adminUserEmail || ''),
        adminUserId: String(org.adminUserId || ''),
      },
      creditos,
      alreadySent: successSnap.data().count,
    });
  } catch (e) {
    console.error('GET /api/admin/campaigns/[id]', e);
    return NextResponse.json({ error: 'Error al leer campaña' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  const denied = assertAdminSession(request);
  if (denied) return denied;

  try {
    const { campaignId } = await params;
    const parsed = patchSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const db = getAdminDb();
    const ref = db.collection('campaigns').doc(campaignId);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: 'Campaña no encontrada' }, { status: 404 });
    }

    const current = snap.data()!;
    const unsent = isUnsentCampaign(current);
    const d = parsed.data;
    const contentTouched =
      d.nombre != null ||
      d.asunto != null ||
      d.cuerpo != null ||
      d.canal != null ||
      d.waTemplateName != null ||
      d.waTemplateLang != null ||
      d.waTemplateVariables != null ||
      d.waUrlButton != null;
    if (contentTouched && !unsent) {
      return NextResponse.json({ error: UNSENT_EDIT_ERROR }, { status: 409 });
    }

    const patch: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
    if (contentTouched && unsent && String(current.estado) === 'cancelada') patch.estado = 'borrador';
    if (d.nombre != null) patch.nombre = d.nombre.trim();
    if (d.asunto != null) patch.asunto = d.asunto.trim();
    if (d.cuerpo != null) patch.cuerpo = d.cuerpo.trim();
    if (d.canal != null) patch.canal = d.canal as CanalCampaign;
    if (d.waTemplateName != null) patch.waTemplateName = d.waTemplateName.trim();
    if (d.waTemplateLang != null) patch.waTemplateLang = d.waTemplateLang.trim() || 'es_AR';
    if (d.waTemplateVariables != null) patch.waTemplateVariables = d.waTemplateVariables.filter(Boolean);
    if (d.waUrlButton != null) patch.waUrlButton = d.waUrlButton === true;
    if (d.tandaSize != null) patch.tandaSize = d.tandaSize;

    await ref.update(patch);
    const updated = await ref.get();
    return NextResponse.json({ campaign: serializeCampaign(updated.id, updated.data()!) });
  } catch (e) {
    console.error('PATCH /api/admin/campaigns/[id]', e);
    return NextResponse.json({ error: 'Error al actualizar campaña' }, { status: 500 });
  }
}
