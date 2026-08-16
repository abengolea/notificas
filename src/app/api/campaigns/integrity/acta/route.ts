import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthToken } from '@/lib/auth-helper';
import { getOrgIfMember } from '@/lib/org-server';
import { getAdminDb } from '@/lib/firebase-admin';
import { buildActaTandaPdf, type ActaLeafRow } from '@/lib/campaign-integrity-pdf';

function formatSealedAt(v: unknown): string | undefined {
  if (!v) return undefined;
  if (typeof v === 'string') {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? v : d.toLocaleString('es-AR');
  }
  if (typeof v === 'object' && v && 'toDate' in v && typeof (v as { toDate: () => Date }).toDate === 'function') {
    try {
      return (v as { toDate: () => Date }).toDate().toLocaleString('es-AR');
    } catch {
      return undefined;
    }
  }
  if (typeof v === 'object' && v && ('_seconds' in v || 'seconds' in v)) {
    const secs = Number((v as { _seconds?: number; seconds?: number })._seconds ?? (v as { seconds?: number }).seconds);
    if (Number.isFinite(secs)) return new Date(secs * 1000).toLocaleString('es-AR');
  }
  return undefined;
}

export async function GET(request: NextRequest) {
  const { decoded, errorResponse } = await verifyAuthToken(request);
  if (errorResponse) return errorResponse;

  const campaignId = request.nextUrl.searchParams.get('campaignId') || '';
  const orgId = request.nextUrl.searchParams.get('orgId') || '';
  const batchId = request.nextUrl.searchParams.get('batchId') || '';
  if (!campaignId || !orgId || !batchId) {
    return NextResponse.json({ error: 'campaignId, orgId y batchId requeridos' }, { status: 400 });
  }

  const orgGate = await getOrgIfMember(decoded!.uid, orgId, decoded!.email);
  if (!orgGate) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const db = getAdminDb();
  const campSnap = await db.collection('campaigns').doc(campaignId).get();
  if (!campSnap.exists || String(campSnap.data()?.orgId) !== orgId) {
    return NextResponse.json({ error: 'Campaña no encontrada' }, { status: 404 });
  }

  const batchRef = db.collection('campaigns').doc(campaignId).collection('integrity_batches').doc(batchId);
  const batchSnap = await batchRef.get();
  if (!batchSnap.exists) {
    return NextResponse.json({ error: 'Tanda no encontrada' }, { status: 404 });
  }

  const batch = batchSnap.data()!;
  const leavesSnap = await batchRef.collection('leaves').get();
  type LeafDoc = {
    id: string;
    messageId?: string;
    leafHash?: string;
    leafIndex?: number;
    contentHash?: string;
    eventType?: string;
    occurredAt?: string;
  };
  const rawLeaves: LeafDoc[] = leavesSnap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<LeafDoc, 'id'>) }))
    .sort((a, b) => a.id.localeCompare(b.id));

  const messageIds = [...new Set(rawLeaves.map((l) => String(l.messageId || '')).filter(Boolean))];
  const msgById = new Map<string, FirebaseFirestore.DocumentData>();
  for (let i = 0; i < messageIds.length; i += 100) {
    const chunk = messageIds.slice(i, i + 100);
    const refs = chunk.map((id) => db.collection('campaign_messages').doc(id));
    const snaps = await db.getAll(...refs);
    for (const s of snaps) {
      if (s.exists) msgById.set(s.id, s.data()!);
    }
  }

  const leaves: ActaLeafRow[] = rawLeaves.map((leaf, i) => {
    const msg = msgById.get(String(leaf.messageId || '')) || {};
    return {
      leafIndex: typeof leaf.leafIndex === 'number' ? leaf.leafIndex : i,
      messageId: String(leaf.messageId || ''),
      leafHash: String(leaf.leafHash || ''),
      contentHash: typeof leaf.contentHash === 'string' ? leaf.contentHash : undefined,
      eventType: typeof leaf.eventType === 'string' ? leaf.eventType : undefined,
      occurredAt: typeof leaf.occurredAt === 'string' ? leaf.occurredAt : undefined,
      nombre: String(msg.recipientNombre || ''),
      email: String(msg.recipientEmail || ''),
      telefono: String(msg.recipientTelefono || ''),
      dni: String(msg.recipientDni || ''),
    };
  });

  const org = orgGate.data;
  const campaign = campSnap.data()!;

  try {
    const pdf = await buildActaTandaPdf({
      orgNombre: String(org.nombre || ''),
      orgCuit: typeof org.cuit === 'string' ? org.cuit : undefined,
      campaignId,
      campaignNombre: String(campaign.nombre || ''),
      campaignAsunto: typeof campaign.asunto === 'string' ? campaign.asunto : undefined,
      batchId,
      kind: batch.kind === 'event' ? 'event' : 'send',
      status: String(batch.status || 'open'),
      leafCount: leaves.length,
      merkleRoot: typeof batch.merkleRoot === 'string' ? batch.merkleRoot : undefined,
      txHash: typeof batch.txHash === 'string' ? batch.txHash : undefined,
      payload: typeof batch.payload === 'string' ? batch.payload : undefined,
      sealedAt: formatSealedAt(batch.sealedAt),
      generatedAt: new Date().toLocaleString('es-AR'),
      leaves,
    });

    const safeBatch = batchId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40);
    return new NextResponse(pdf, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="acta-tanda-${safeBatch}.pdf"`,
      },
    });
  } catch (e) {
    console.error('GET /api/campaigns/integrity/acta', e);
    return NextResponse.json({ error: 'Error al generar el acta PDF' }, { status: 500 });
  }
}
