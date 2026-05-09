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

const putSchema = z.object({
  nombre: z.string().min(2).max(200).optional(),
  recipients: z.array(entrySchema).optional(),
});

type RouteContext = { params: Promise<{ listId: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { decoded, errorResponse } = await verifyAuthToken(request);
    if (errorResponse) return errorResponse;

    const { listId } = await context.params;
    const db = getAdminDb();
    const snap = await db.collection('recipient_lists').doc(listId).get();
    if (!snap.exists) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

    const data = snap.data()!;
    const org = await getOrgIfMember(decoded!.uid, String(data.orgId), decoded!.email);
    if (!org) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

    return NextResponse.json({ id: snap.id, ...data });
  } catch (e) {
    console.error('GET /api/recipient-lists/[listId]', e);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { decoded, errorResponse } = await verifyAuthToken(request);
    if (errorResponse) return errorResponse;

    const { listId } = await context.params;
    const body = await request.json();
    const parsed = putSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const db = getAdminDb();
    const ref = db.collection('recipient_lists').doc(listId);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

    const data = snap.data()!;
    const org = await getOrgIfMember(decoded!.uid, String(data.orgId), decoded!.email);
    if (!org) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

    const update: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
    if (parsed.data.nombre) update.nombre = parsed.data.nombre.trim();
    if (parsed.data.recipients) {
      const recipients = parsed.data.recipients.map((r) => ({
        email: r.email.trim().toLowerCase(),
        nombre: r.nombre.trim(),
        dni: r.dni?.trim() || undefined,
        legajo: r.legajo?.trim() || undefined,
        telefono: r.telefono?.trim() || undefined,
        area: r.area?.trim() || undefined,
      }));
      update.recipients = recipients;
      update.count = recipients.length;
    }

    await ref.update(update);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('PUT /api/recipient-lists/[listId]', e);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { decoded, errorResponse } = await verifyAuthToken(request);
    if (errorResponse) return errorResponse;

    const { listId } = await context.params;
    const db = getAdminDb();
    const ref = db.collection('recipient_lists').doc(listId);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

    const data = snap.data()!;
    const org = await getOrgIfMember(decoded!.uid, String(data.orgId), decoded!.email);
    if (!org) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

    await ref.delete();
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('DELETE /api/recipient-lists/[listId]', e);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
