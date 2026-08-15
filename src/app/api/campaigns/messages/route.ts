import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { getAdminAuth } from '@/lib/firebase-admin';

const PAGE_SIZE = 100;

export async function GET(request: NextRequest) {
  // Auth
  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.replace('Bearer ', '').trim();
  if (!token) return NextResponse.json({ error: 'Sin autenticación' }, { status: 401 });
  try {
    await getAdminAuth().verifyIdToken(token);
  } catch {
    return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const campaignId = searchParams.get('campaignId');
  if (!campaignId) return NextResponse.json({ error: 'campaignId requerido' }, { status: 400 });

  const estado  = searchParams.get('estado')  || 'all';
  const search  = (searchParams.get('search') || '').trim();
  const cursor  = searchParams.get('cursor')  || '';
  const limit   = Math.min(parseInt(searchParams.get('limit') || String(PAGE_SIZE)), 200);

  const db = getAdminDb();

  // Base query — siempre ordena por recipientNombre para paginación consistente
  let q: FirebaseFirestore.Query = db
    .collection('campaign_messages')
    .where('campaignId', '==', campaignId)
    .orderBy('recipientNombre')
    .limit(limit + 1); // +1 para saber si hay más

  if (estado !== 'all') {
    q = db
      .collection('campaign_messages')
      .where('campaignId', '==', campaignId)
      .where('estado', '==', estado)
      .orderBy('recipientNombre')
      .limit(limit + 1);
  }

  if (search) {
    const base = estado !== 'all'
      ? db.collection('campaign_messages')
          .where('campaignId', '==', campaignId)
          .where('estado', '==', estado)
      : db.collection('campaign_messages')
          .where('campaignId', '==', campaignId);
    q = base
      .orderBy('recipientNombre')
      .where('recipientNombre', '>=', search)
      .where('recipientNombre', '<=', search + '')
      .limit(limit + 1);
  }

  // Cursor de paginación — startAfter el último doc de la página anterior
  if (cursor) {
    const cursorSnap = await db.collection('campaign_messages').doc(cursor).get();
    if (cursorSnap.exists) q = q.startAfter(cursorSnap);
  }

  const snap = await q.get();
  const hasMore = snap.docs.length > limit;
  const docs = hasMore ? snap.docs.slice(0, limit) : snap.docs;

  const messages = docs.map((d) => ({ id: d.id, ...d.data() }));
  const nextCursor = hasMore ? docs[docs.length - 1].id : null;

  return NextResponse.json({ messages, nextCursor, hasMore });
}
