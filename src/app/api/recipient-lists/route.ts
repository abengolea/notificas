import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { verifyAuthToken } from '@/lib/auth-helper';
import { getAdminDb } from '@/lib/firebase-admin';
import { getOrgIfMember } from '@/lib/org-server';
import { z } from 'zod';

const entrySchema = z.object({
  email: z.string().email(),
  nombre: z.string().min(1),
  dni: z.string().optional(),
  legajo: z.string().optional(),
  telefono: z.string().optional(),
  area: z.string().optional(),
});

const postSchema = z.object({
  orgId: z.string().min(1),
  nombre: z.string().min(2).max(200),
  recipients: z.array(entrySchema).min(1),
});

export async function GET(request: NextRequest) {
  try {
    const { decoded, errorResponse } = await verifyAuthToken(request);
    if (errorResponse) return errorResponse;

    const orgId = request.nextUrl.searchParams.get('orgId');
    if (!orgId) {
      return NextResponse.json({ error: 'orgId requerido' }, { status: 400 });
    }

    const org = await getOrgIfMember(decoded!.uid, orgId, decoded!.email);
    if (!org) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

    const snap = await getAdminDb()
      .collection('recipient_lists')
      .where('orgId', '==', orgId)
      .orderBy('updatedAt', 'desc')
      .get();

    const lists = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return NextResponse.json({ lists });
  } catch (e) {
    console.error('GET /api/recipient-lists', e);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { decoded, errorResponse } = await verifyAuthToken(request);
    if (errorResponse) return errorResponse;

    const body = await request.json();
    const parsed = postSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const org = await getOrgIfMember(decoded!.uid, parsed.data.orgId, decoded!.email);
    if (!org) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

    const recipients = parsed.data.recipients.map((r) => ({
      email: r.email.trim().toLowerCase(),
      nombre: r.nombre.trim(),
      dni: r.dni?.trim() || undefined,
      legajo: r.legajo?.trim() || undefined,
      telefono: r.telefono?.trim() || undefined,
      area: r.area?.trim() || undefined,
    }));

    const ref = await getAdminDb().collection('recipient_lists').add({
      orgId: parsed.data.orgId,
      nombre: parsed.data.nombre.trim(),
      recipients,
      count: recipients.length,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ id: ref.id, count: recipients.length });
  } catch (e) {
    console.error('POST /api/recipient-lists', e);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
