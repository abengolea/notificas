import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { verifyAuthToken } from '@/lib/auth-helper';
import { getAdminDb } from '@/lib/firebase-admin';
import { normalizeEnviosDisponibles } from '@/lib/envios';
import { getOrgIfMember, maxRecipientsForPlan } from '@/lib/org-server';
import { enqueueCampaignFanout } from '@/lib/cloud-tasks';
import type { RecipientEntry } from '@/lib/types';
import { z } from 'zod';

const bodySchema = z.object({
  campaignId: z.string().min(1),
  orgId: z.string().min(1),
});

type MsgState = 'pendiente' | 'enviado' | 'leido' | 'error';

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

    const campRef = db.collection('campaigns').doc(parsed.data.campaignId);
    const campSnap = await campRef.get();
    if (!campSnap.exists) return NextResponse.json({ error: 'Campaña no encontrada' }, { status: 404 });

    const campaign = campSnap.data()!;
    if (String(campaign.orgId) !== parsed.data.orgId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }
    if (campaign.estado !== 'enviando') {
      return NextResponse.json({ error: 'La campaña debe estar en estado enviando' }, { status: 400 });
    }

    const plan = String(orgGate.data.plan || 'starter');
    const maxRecipients = maxRecipientsForPlan(plan);

    const useStorage = !!campaign.recipientStoragePath;
    let recipientData: RecipientEntry[] = [];
    let totalRecipients: number;

    if (useStorage) {
      // 150k+: no cargamos todos los destinatarios en memoria.
      totalRecipients = typeof campaign.recipientCount === 'number' ? campaign.recipientCount : 0;
      if (totalRecipients === 0) {
        return NextResponse.json({ error: 'Sin destinatarios (Storage vacío)' }, { status: 400 });
      }
    } else {
      recipientData = Array.isArray(campaign.recipientData)
        ? (campaign.recipientData as RecipientEntry[])
        : [];
      if (recipientData.length === 0 && Array.isArray(campaign.recipientEmails)) {
        recipientData = (campaign.recipientEmails as string[]).map((email) => ({
          email: String(email).trim().toLowerCase(),
          nombre: String(email).split('@')[0],
        }));
      }
      totalRecipients = recipientData.length;
      if (totalRecipients === 0) {
        return NextResponse.json({ error: 'Sin destinatarios' }, { status: 400 });
      }
    }

    if (totalRecipients > maxRecipients) {
      return NextResponse.json(
        { error: `Máximo ${maxRecipients} destinatarios para el plan ${plan}` },
        { status: 400 }
      );
    }

    const userRef = db.collection('users').doc(uid);
    const userSnap = await userRef.get();
    const creditosInicial = normalizeEnviosDisponibles(userSnap.data()?.creditos);

    let cobrosEsperados: number;
    let pendingCount: number;

    if (useStorage) {
      // Para campañas con Storage: contar mensajes ya exitosos y restar.
      const successCount = await db
        .collection('campaign_messages')
        .where('campaignId', '==', parsed.data.campaignId)
        .where('estado', 'in', ['enviado', 'leido'])
        .count()
        .get();
      const successTotal = successCount.data().count;
      cobrosEsperados = Math.max(0, totalRecipients - successTotal);
      pendingCount = cobrosEsperados;
    } else {
      const loadMsgIndex = async () => {
        const existingSnap = await db
          .collection('campaign_messages')
          .where('campaignId', '==', parsed.data.campaignId)
          .get();
        const byEmail = new Map<string, { id: string; estado: MsgState; creditApplied?: boolean; mailId?: string }>();
        existingSnap.docs.forEach((docItem) => {
          const data = docItem.data();
          const em = String(data.recipientEmail || '').toLowerCase();
          byEmail.set(em, {
            id: docItem.id,
            estado: (data.estado as MsgState) || 'pendiente',
            creditApplied: !!data.creditApplied,
            mailId: typeof data.mailId === 'string' ? data.mailId : undefined,
          });
        });
        return byEmail;
      };

      const byEmail = await loadMsgIndex();

      const trabajo = recipientData.filter((row) => {
        const email = row.email.trim().toLowerCase();
        const cur = byEmail.get(email);
        if (!cur) return true;
        if (cur.estado === 'enviado' || cur.estado === 'leido') return false;
        if (cur.estado === 'error') return true;
        if (cur.estado === 'pendiente') return true;
        return false;
      });

      cobrosEsperados = trabajo.filter((row) => {
        const email = row.email.trim().toLowerCase();
        const cur = byEmail.get(email);
        if (!cur) return true;
        if (cur.estado === 'error') return true;
        if (cur.estado === 'pendiente' && !cur.creditApplied) return true;
        return false;
      }).length;
      pendingCount = trabajo.length;
    }

    if (creditosInicial < cobrosEsperados) {
      return NextResponse.json(
        {
          error: `Envíos insuficientes: necesitás ${cobrosEsperados}, tenés ${creditosInicial}`,
        },
        { status: 400 }
      );
    }

    const senderEmail = decoded!.email || '';

    // Guardar email del remitente en la campaña para que los workers lo usen sin token de usuario.
    await campRef.update({
      senderEmail: senderEmail,
      senderUid: uid,
      enqueuedAt: FieldValue.serverTimestamp(),
    });

    // Encolar el fanout que creará los campaign_messages y los workers de envío.
    await enqueueCampaignFanout(parsed.data.campaignId, 0);

    return NextResponse.json({ queued: true, total: totalRecipients, pending: pendingCount });
  } catch (e: unknown) {
    console.error('POST /api/campaigns/send', e);
    const msg = e instanceof Error ? e.message : 'Error interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
