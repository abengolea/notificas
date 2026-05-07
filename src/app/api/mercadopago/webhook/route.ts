import { NextRequest, NextResponse } from 'next/server';
import { settleMercadoPagoPayment } from '@/lib/mercado-pago-settle';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('🔔 Webhook MercadoPago recibido:', body);

    const isPayment =
      body.type === 'payment' ||
      (typeof body.action === 'string' && body.action.startsWith('payment.'));

    if (!isPayment) {
      return NextResponse.json({ received: true });
    }

    const paymentId = body.data?.id;
    if (paymentId == null) {
      return NextResponse.json({ error: 'Payment ID no encontrado' }, { status: 400 });
    }

    const result = await settleMercadoPagoPayment({
      paymentId: String(paymentId),
      actorUserId: null,
    });

    if (!result.ok) {
      if (result.error === 'Pago no aprobado') {
        return NextResponse.json({ received: true, pending: true });
      }
      console.error('❌ Webhook: no se pudo acreditar:', result.error);
      return NextResponse.json({ error: result.error }, { status: result.status });
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
