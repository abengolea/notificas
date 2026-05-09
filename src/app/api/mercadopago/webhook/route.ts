import { NextRequest, NextResponse } from 'next/server';
import { settleMercadoPagoPayment } from '@/lib/mercado-pago-settle';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const sp = request.nextUrl.searchParams;
    const qsPaymentId = sp.get('data.id') ?? sp.get('id');

    console.log('🔔 Webhook MercadoPago recibido:', {
      body,
      query: Object.fromEntries(sp.entries()),
    });

    const topicPayment =
      body.topic === 'payment' ||
      sp.get('topic') === 'payment' ||
      sp.get('type') === 'payment';

    const isPayment =
      body.type === 'payment' ||
      (typeof body.action === 'string' && body.action.startsWith('payment.')) ||
      topicPayment;

    if (!isPayment) {
      return NextResponse.json({ received: true });
    }

    const rawId = body.data?.id ?? body.id ?? qsPaymentId;
    const paymentId =
      rawId != null && String(rawId).trim() !== '' ? String(rawId).trim() : null;

    if (paymentId == null) {
      return NextResponse.json({ error: 'Payment ID no encontrado' }, { status: 400 });
    }

    const result = await settleMercadoPagoPayment({
      paymentId,
      actorUserId: null,
    });

    if (!result.ok) {
      if (result.error === 'Pago no aprobado') {
        return NextResponse.json({ received: true, pending: true });
      }
      // Mercado Pago marca fallo ante 5xx; la simulación usa IDs ficticios sin recurso en la API MP.
      // Respondemos siempre 2xx para el notificador; el detalle queda en logs.
      console.error('❌ Webhook: liquidación omitida:', {
        paymentId,
        error: result.error,
      });
      return NextResponse.json({ received: true, settled: false });
    }

    console.log(
      result.alreadySettled
        ? 'ℹ️ Webhook: pago ya estaba acreditado'
        : '✅ Webhook: créditos acreditados'
    );

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('❌ Error procesando webhook:', error);
    return NextResponse.json(
      { error: 'Error procesando webhook' },
      { status: 500 }
    );
  }
}

// Manejar GET para verificación del webhook
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const topic = searchParams.get('topic');
  const id = searchParams.get('id');

  if (topic === 'payment' && id) {
    console.log('🔍 Verificación de webhook - Payment ID:', id);
    return NextResponse.json({ received: true });
  }

  return NextResponse.json({ received: true });
}
