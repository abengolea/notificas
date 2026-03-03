import { MercadoPagoConfig, Preference } from 'mercadopago';

// Configuración de Mercado Pago
const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN!,
  options: {
    timeout: 5000,
    idempotencyKey: 'abc'
  }
});

export const preference = new Preference(client);

// Tipos para la integración
export interface MercadoPagoPreference {
  id: string;
  init_point: string;
  sandbox_init_point: string;
}

export interface CreatePreferenceData {
  planId: string;
  planName: string;
  price: number;
  credits: number;
  userId: string;
  userEmail: string;
}

// Función para crear preferencia de pago
export async function createPaymentPreference(data: CreatePreferenceData): Promise<MercadoPagoPreference> {
  try {
    console.log('🔑 MercadoPago Access Token:', process.env.MERCADOPAGO_ACCESS_TOKEN?.substring(0, 20) + '...');
    console.log('🌍 Environment:', process.env.MERCADOPAGO_ENVIRONMENT);
    console.log('📦 Data recibida:', data);
    const preferenceData = {
      items: [
        {
          id: data.planId,
          title: data.planName,
          description: `Compra de ${data.credits} créditos para notificaciones certificadas`,
          quantity: 1,
          unit_price: data.price,
          currency_id: 'ARS'
        }
      ],
      payer: {
        email: data.userEmail,
        identification: {
          type: 'DNI',
          number: '12345678' // En producción, obtener del usuario
        }
      },
      payment_methods: {
        excluded_payment_methods: [],
        excluded_payment_types: [],
        installments: 12
      },
      back_urls: {
        success: 'https://www.mercadopago.com.ar/checkout/confirmation',
        failure: 'https://www.mercadopago.com.ar/checkout/confirmation',
        pending: 'https://www.mercadopago.com.ar/checkout/confirmation'
      },
      external_reference: `plan_${data.planId}_user_${data.userId}`,
      metadata: {
        plan_id: data.planId,
        user_id: data.userId,
        credits: data.credits.toString()
      }
    };

    const response = await preference.create({ body: preferenceData });
    
    return {
      id: response.id!,
      init_point: response.init_point!,
      sandbox_init_point: response.sandbox_init_point!
    };
  } catch (error) {
    console.error('Error creating MercadoPago preference:', error);
    throw new Error('Error al crear la preferencia de pago');
  }
}

// Función para verificar el estado de un pago
export async function getPaymentStatus(paymentId: string) {
  try {
    const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: {
        'Authorization': `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error('Error al obtener el estado del pago');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error getting payment status:', error);
    throw error;
  }
}
