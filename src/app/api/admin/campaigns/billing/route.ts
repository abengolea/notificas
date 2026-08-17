import { NextRequest, NextResponse } from 'next/server';
import { assertAdminSession } from '@/lib/assert-admin-session';
import { getAdminDb } from '@/lib/firebase-admin';
import { normalizeEnviosDisponibles } from '@/lib/envios';

export async function GET(request: NextRequest) {
  const denied = assertAdminSession(request);
  if (denied) return denied;

  const orgId = request.nextUrl.searchParams.get('orgId')?.trim() || '';
  if (!orgId) {
    return NextResponse.json({ error: 'orgId requerido' }, { status: 400 });
  }

  try {
    const db = getAdminDb();
    const orgSnap = await db.collection('organizations').doc(orgId).get();
    if (!orgSnap.exists) {
      return NextResponse.json({ error: 'Organización no encontrada' }, { status: 404 });
    }
    const org = orgSnap.data()!;
    const adminUserId = String(org.adminUserId || '');
    const userSnap = adminUserId ? await db.collection('users').doc(adminUserId).get() : null;
    return NextResponse.json({
      orgId,
      nombre: String(org.nombre || ''),
      plan: String(org.plan || 'starter'),
      adminUserId,
      adminUserEmail: String(org.adminUserEmail || ''),
      creditos: normalizeEnviosDisponibles(userSnap?.data()?.creditos),
    });
  } catch (e) {
    console.error('GET /api/admin/campaigns/billing', e);
    return NextResponse.json({ error: 'Error al leer créditos' }, { status: 500 });
  }
}
