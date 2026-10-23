import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { verifyAuthToken } from '@/lib/auth-helper';
import { tryBuildInvoicePdfFromTransaction } from '@/lib/invoice-from-transaction';

type RouteContext = {
  params: Promise<{ transactionId: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  const { decoded, errorResponse } = await verifyAuthToken(request);
  if (errorResponse) return errorResponse;

  const { transactionId } = await context.params;
  if (!transactionId || transactionId.includes('/')) {
    return NextResponse.json({ error: 'Transacción inválida' }, { status: 400 });
  }

  const db = getAdminDb();
  const snap = await db.collection('user_transactions').doc(transactionId).get();
  if (!snap.exists) {
    return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 });
  }

  const tx = snap.data() as Record<string, unknown>;
  if (tx.userId !== decoded.uid) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const built = tryBuildInvoicePdfFromTransaction(tx);
  if (!built.ok) {
    return NextResponse.json({ error: built.error }, { status: built.status });
  }

  return new NextResponse(new Uint8Array(built.pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${built.filename}"`,
      'Cache-Control': 'private, max-age=0, must-revalidate',
    },
  });
}
