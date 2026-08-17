import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { requireCampaignViewer } from '@/lib/campaign-access';
import { maybeCompleteCampaign } from '@/lib/campaign-complete';
import { campaignMessageMatchesSearch } from '@/lib/search-text';

const PAGE_SIZE = 100;
const SEARCH_SCAN_PAGE = 400;

function campaignMessagesBase(
  db: FirebaseFirestore.Firestore,
  campaignId: string,
  estado: string,
  flag: string,
): FirebaseFirestore.Query {
  let q: FirebaseFirestore.Query = db.collection('campaign_messages').where('campaignId', '==', campaignId);
  if (flag === 'waWmidMissing') q = q.where('waWmidMissing', '==', true);
  else if (estado !== 'all') q = q.where('estado', '==', estado);
  return q;
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const campaignId = searchParams.get('campaignId');
  if (!campaignId) return NextResponse.json({ error: 'campaignId requerido' }, { status: 400 });

  const denied = await requireCampaignViewer(request, campaignId);
  if (denied) return denied;

  const estado  = searchParams.get('estado')  || 'all';
  const search  = (searchParams.get('search') || '').trim();
  const cursor  = searchParams.get('cursor')  || '';
  const flag    = searchParams.get('flag') || '';
  const limit   = Math.min(parseInt(searchParams.get('limit') || String(PAGE_SIZE)), 200);

  const db = getAdminDb();
  void maybeCompleteCampaign(db.collection('campaigns').doc(campaignId)).catch(() => undefined);

  const base = campaignMessagesBase(db, campaignId, estado, flag);

  if (search) {
    const page: FirebaseFirestore.QueryDocumentSnapshot[] = [];
    let filteredTotal = 0;
    let passedCursor = !cursor;
    let lastDoc: FirebaseFirestore.QueryDocumentSnapshot | null = null;

    for (;;) {
      let scan: FirebaseFirestore.Query = base.orderBy('recipientNombre').limit(SEARCH_SCAN_PAGE);
      if (lastDoc) scan = scan.startAfter(lastDoc);
      const snap = await scan.get();
      if (snap.empty) break;

      for (const d of snap.docs) {
        if (!campaignMessageMatchesSearch(d.data(), search)) continue;
        filteredTotal += 1;
        if (!passedCursor) {
          if (d.id === cursor) passedCursor = true;
          continue;
        }
        if (page.length < limit + 1) page.push(d);
      }

      lastDoc = snap.docs[snap.docs.length - 1];
      if (snap.size < SEARCH_SCAN_PAGE) break;
    }

    const hasMore = page.length > limit;
    const docs = hasMore ? page.slice(0, limit) : page;
    return NextResponse.json({
      messages: docs.map((d) => ({ id: d.id, ...d.data() })),
      nextCursor: hasMore ? docs[docs.length - 1].id : null,
      hasMore,
      filteredTotal,
    });
  }

  let q = base.orderBy('recipientNombre').limit(limit + 1);

  if (cursor) {
    const cursorSnap = await db.collection('campaign_messages').doc(cursor).get();
    if (cursorSnap.exists) q = q.startAfter(cursorSnap);
  }

  const snap = await q.get();
  const hasMore = snap.docs.length > limit;
  const docs = hasMore ? snap.docs.slice(0, limit) : snap.docs;

  let filteredTotal: number | null = null;
  if (estado !== 'all' || flag === 'waWmidMissing') {
    filteredTotal = (await base.count().get()).data().count;
  }

  return NextResponse.json({
    messages: docs.map((d) => ({ id: d.id, ...d.data() })),
    nextCursor: hasMore ? docs[docs.length - 1].id : null,
    hasMore,
    filteredTotal,
  });
}
