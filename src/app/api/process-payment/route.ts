import { NextRequest, NextResponse } from 'next/server';
import { settleMercadoPagoPayment } from '@/lib/mercado-pago-settle';
import { verifyAuthToken } from '@/lib/auth-helper';
import { requestHubInvoiceForMercadoPagoPayment } from '@/lib/notificas-hub-billing';

/**
 * Concilia un pago aprobado con la transacción pendiente en Firestore.
 * - Con `Authorization: Bearer <Firebase ID token>`: el uid del token debe ser el comprador (recomendado).
 * - Sin token: modo legacy compatible con `{ paymentId, userId }` (solo para soporte/admin con cuidado).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { paymentId: bodyPaymentId, userId: bodyUserId } = body as {
      paymentId?: string;
      userId?: string;
    };

    const authHeader = request.headers.get('Authorization');
    let actorUserId: string | null = null;

    if (authHeader?.startsWith('Bearer ')) {
      const auth = await verifyAuthToken(request);
      if (auth.errorResponse) {
        return auth.errorResponse;
      }
      actorUserId = auth.decoded.uid;
    } else if (typeof bodyUserId === 'string' && bodyUserId.length > 0) {
      actorUserId = bodyUserId;
    }

    const paymentId = bodyPaymentId;
    if (!paymentId || !String(paymentId).trim()) {
      return NextResponse.json(
        { error: 'paymentId es requerido' },
        { status: 400 }
      );
    }

    if (!actorUserId) {
      return NextResponse.json(
        { error: 'Iniciá sesión de nuevo o indicá userId en modo soporte.' },
        { status: 401 }
      );
    }

    const result = await settleMercadoPagoPayment({
      paymentId: String(paymentId),
      actorUserId,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    const billing = await requestHubInvoiceForMercadoPagoPayment(String(paymentId));
    if (!billing.ok && !billing.skipped) {
      console.error('❌ process-payment: facturación Hub falló', {
        paymentId,
        error: billing.error,
        status: billing.status,
      });
    }

    return NextResponse.json({
      success: true,
      message: result.alreadySettled
        ? 'El pago ya estaba acreditado'
        : 'Pago procesado correctamente',
      creditsAdded: result.creditsAdded,
      alreadySettled: result.alreadySettled,
      billingHub: billing,
    });
  } catch (error) {
    console.error('❌ Error procesando pago:', error);
    return NextResponse.json(
      { error: 'Error procesando pago' },
      { status: 500 }
    );
  }
}
