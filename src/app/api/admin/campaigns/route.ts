import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';
import { assertAdminSession } from '@/lib/assert-admin-session';
import { getAdminDb } from '@/lib/firebase-admin';
import { normalizeEnviosDisponibles } from '@/lib/envios';
import type { CanalCampaign } from '@/lib/types';

const createSchema = z.object({
  orgId: z.string().min(1),
  nombre: z.string().min(2).max(200),
  asunto: z.string().min(1).max(300),
  cuerpo: z.string().min(1).max(20000),
  canal: z.enum(['email', 'whatsapp', 'ambos']),
  waTemplateName: z.string().max(128).optional(),
  waTemplateLang: z.string().max(16).optional(),
  waTemplateVariables: z.array(z.string().max(40)).max(8).optional(),
  waUrlButton: z.boolean().optional(),
  tandaSize: z.number().int().min(0).optional(),
  simulated: z.boolean().optional(),
});

function serializeCampaign(id: string, data: FirebaseFirestore.DocumentData) {
  return {
    id,
    orgId: String(data.orgId || ''),
    createdBy: String(data.createdBy || ''),
    nombre: String(data.nombre || ''),
    asunto: String(data.asunto || ''),
    cuerpo: String(data.cuerpo || ''),
    canal: (data.canal as CanalCampaign) || 'email',
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

export async function GET(request: NextRequest) {
  const denied = assertAdminSession(request);
  if (denied) return denied;

  try {
    const db = getAdminDb();
    const snap = await db.collection('campaigns').where('managedByAdmin', '==', true).limit(200).get();
    const campaigns = snap.docs
      .map((d) => serializeCampaign(d.id, d.data()))
      .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    return NextResponse.json({ campaigns });
  } catch (e) {
    console.error('GET /api/admin/campaigns', e);
    return NextResponse.json({ error: 'Error al listar campañas' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const denied = assertAdminSession(request);
  if (denied) return denied;

  try {
    const parsed = createSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const db = getAdminDb();
    const orgSnap = await db.collection('organizations').doc(parsed.data.orgId).get();
    if (!orgSnap.exists) {
      return NextResponse.json({ error: 'Organización no encontrada' }, { status: 404 });
    }
    const org = orgSnap.data()!;
    const adminUserId = String(org.adminUserId || '');
    const adminUserEmail = String(org.adminUserEmail || '');
    if (!adminUserId) {
      return NextResponse.json(
        { error: 'La organización no tiene administrador (adminUserId)' },
        { status: 400 }
      );
    }

    const canal = parsed.data.canal;
    const ref = await db.collection('campaigns').add({
      orgId: parsed.data.orgId,
      createdBy: adminUserId,
      managedByAdmin: true,
      canal,
      nombre: parsed.data.nombre.trim(),
      asunto: parsed.data.asunto.trim(),
      cuerpo: parsed.data.cuerpo.trim(),
      adjuntos: [],
      recipientCount: 0,
      tandaSize: parsed.data.tandaSize ?? 0,
      simulated: parsed.data.simulated === true,
      ...(canal !== 'email' && parsed.data.waTemplateName?.trim()
        ? {
            waTemplateName: parsed.data.waTemplateName.trim(),
            waTemplateLang: parsed.data.waTemplateLang?.trim() || 'es_AR',
            waTemplateVariables: parsed.data.waTemplateVariables?.filter(Boolean) || ['nombre'],
            waUrlButton: parsed.data.waUrlButton === true,
          }
        : {}),
      senderUid: adminUserId,
      senderEmail: adminUserEmail,
      estado: 'borrador',
      stats: { total: 0, enviados: 0, leidos: 0, pendientes: 0, errores: 0 },
      createdAt: FieldValue.serverTimestamp(),
      startedAt: null,
    });

    const userSnap = await db.collection('users').doc(adminUserId).get();
    const creditos = normalizeEnviosDisponibles(userSnap.data()?.creditos);

    return NextResponse.json({
      id: ref.id,
      orgNombre: String(org.nombre || ''),
      orgPlan: String(org.plan || 'starter'),
      senderEmail: adminUserEmail,
      creditos,
    });
  } catch (e) {
    console.error('POST /api/admin/campaigns', e);
    return NextResponse.json({ error: 'Error al crear campaña' }, { status: 500 });
  }
}
