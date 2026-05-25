import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { verifyAuthToken } from '@/lib/auth-helper';
import { buildInvoicePdfBuffer } from '@/lib/invoice-pdf';

type RouteContext = {
  params: Promise<{ transactionId: string }>;
};

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function asString(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  return text || null;
}

function toDate(value: unknown): Date | null {
  if (value instanceof Date) return value;
  if (
    value &&
    typeof value === 'object' &&
    typeof (value as { toDate?: unknown }).toDate === 'function'
  ) {
    return (value as { toDate: () => Date }).toDate();
  }
  return null;
}

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

  const billingHub = (tx.billingHub ?? {}) as Record<string, unknown>;
  const cae = asString(billingHub.cae);
  if (billingHub.status !== 'issued' || !cae) {
    return NextResponse.json({ error: 'La factura todavía no está disponible' }, { status: 404 });
  }

  const pdf = await buildInvoicePdfBuffer({
    tipoComprobante: asString(billingHub.tipoComprobante) ?? undefined,
    cbteTipo: asNumber(billingHub.cbteTipo) ?? undefined,
    puntoVenta: asNumber(billingHub.ptoVta) ?? undefined,
    numero: asNumber(billingHub.voucherNumber) ?? undefined,
    fecha: toDate(tx.fecha) ?? new Date(),
    cae,
    caeFchVto: asString(billingHub.caeFchVto),
    receptor: {
      razonSocial: asString(billingHub.buyerRazonSocial),
      cuit: asString(billingHub.buyerCuit),
      email: asString(billingHub.buyerEmail),
      domicilio: asString(billingHub.buyerDomicilio),
    },
    descripcion: asString(tx.descripcion),
    netoGravado: asNumber(billingHub.netoGravado),
    iva: asNumber(billingHub.iva),
    total: asNumber(billingHub.total) ?? asNumber(tx.monto),
  });

  const pv = String(asNumber(billingHub.ptoVta) ?? 0).padStart(5, '0');
  const nro = String(asNumber(billingHub.voucherNumber) ?? 0).padStart(8, '0');

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="factura-${pv}-${nro}.pdf"`,
      'Cache-Control': 'private, max-age=0, must-revalidate',
    },
  });
}
