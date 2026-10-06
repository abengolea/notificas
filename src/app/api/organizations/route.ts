import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken } from '@/lib/auth-helper';
import { getAdminDb } from '@/lib/firebase-admin';
import { isEmpresaOnlyUser } from '@/lib/user-account-kind';

export async function GET(request: NextRequest) {
  try {
    const { decoded, errorResponse } = await verifyAuthToken(request);
    if (errorResponse) return errorResponse;

    const db = getAdminDb();
    const uid = decoded!.uid;
    const email = decoded!.email?.trim().toLowerCase();

    const userSnap = await db.collection("users").doc(uid).get();
    const userData = userSnap.exists ? (userSnap.data() as Record<string, unknown>) : {};
    const empresaOnly = isEmpresaOnlyUser(userData);

    const parts = [
      db.collection('organizations').where('adminUserId', '==', uid).get(),
      db.collection('organizations').where('members', 'array-contains', uid).get(),
    ];
    if (email) {
      parts.push(db.collection('organizations').where('adminUserEmail', '==', email).get());
    }

    const snaps = await Promise.all(parts);

    const map = new Map<string, { id: string; [k: string]: unknown }>();
    for (const q of snaps) {
      q.docs.forEach((d) => map.set(d.id, { id: d.id, ...d.data() }));
    }

    return NextResponse.json({
      organizations: [...map.values()],
      empresaOnly,
      userTipo: String(userData.tipo || "individual"),
    });
  } catch (e) {
    console.error('GET /api/organizations', e);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

/** El alta de organizaciones solo vía panel admin: `POST /api/admin/organizations`. */
export async function POST() {
  return NextResponse.json(
    {
      error:
        'El alta de organizaciones la realiza el administrador desde el panel: /admin/empresas (sesión admin).',
    },
    { status: 403 },
  );
}
