import { randomUUID } from 'node:crypto';
import { MercadoPagoConfig, Preference } from 'mercadopago';

/** Identificador Notificas Hub para esta aplicación (“Notificas Pagos”); solo strings ASCII en MP. */
export const NOTIFICAS_HUB_APP_ID = 'notificas_pagos';

export function buildHubExternalReference(transactionId: string): string {
  return `${NOTIFICAS_HUB_APP_ID}_${transactionId}`;
}

/** Devuelve el id del doc `transactions/{id}` si `ref` fue generado por esta app. */
export function parseHubTransactionIdFromExternalReference(ref: string): string | null {
  const prefix = `${NOTIFICAS_HUB_APP_ID}_`;
  if (!ref.startsWith(prefix)) return null;
  const id = ref.slice(prefix.length).trim();
  if (!id || id.length > 128) return null;
  return id;
}

function hubEmitFacturaFromEnv(): 'true' | 'false' {
  return process.env.MERCADOPAGO_HUB_EMIT_FACTURA === 'true' ? 'true' : 'false';
}

function truncateHubField(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 3)}...`;
}

/** HTTPS sin barra final en path; mantiene ?query #hash (MP notifica esa URL literal). */
function normalizeHttpsWebhookUrl(raw: string): string {
  const t = raw.trim().replace(/\s+/g, '');
  try {
    const u = new URL(t);
    if (u.protocol !== 'https:') return t;
    const path = (u.pathname || '/').replace(/\/+$/, '') || '';
    const pathPart = path === '' ? '' : path;
    return `${u.origin}${pathPart}${u.search}${u.hash}`;
  } catch {
    return t.replace(/\/+$/, '');
  }
}

/** Agrega fragmento tipo `sig=...` si el Hub acordó validación por query (MP repite notification_url tal cual). */
function mergeNotificationUrlQuery(baseUrl: string, queryFragment: string | undefined): string {
  const q = queryFragment?.trim().replace(/^[\?&]+/, '');
  if (!q) return baseUrl;
  const sep = baseUrl.includes('?') ? '&' : '?';
  return `${baseUrl}${sep}${q}`;
}

/** Cliente por request: token en runtime (App Hosting) y clave de idempotencia única (MP rechaza duplicados). */
function createPreferenceClient(): Preference {
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN?.trim();
  if (!accessToken) {
    throw new Error('MERCADOPAGO_ACCESS_TOKEN ausente');
  }
  const client = new MercadoPagoConfig({
    accessToken,
    options: {
      timeout: 15000,
      idempotencyKey: randomUUID(),
    },
  });
  return new Preference(client);
}

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
  /** Doc Firestore `transactions/{transactionId}` creado antes de la preferencia (intento único). */
  transactionId: string;
  /** DNI sólo dígitos para payer de MP si existe en perfil */
  payerDniDigits?: string;
  /** Opcional AFIP Hub: tipo comprobante A|B|C */
  hubCbteTipo?: string;
  hubCuitCompradorDigits?: string;
  hubRazonSocial?: string;
  /**
   * Id del doc cliente en Hub `billing_recurrente_clients/{id}`.
   * Si omitís: se usa Auth uid (= doc id cuando Hub y Pagos comparten proyecto y convención).
   */
  hubBillingClientDocId?: string;
  /** Precio de lista antes de descuentos (Mercado Pago cobra `price`). */
  listPrice?: number;
  /** Si aplica descuento colegio, porcentaje 0–100. */
  colegioDiscountPercent?: number;
}

/**
 * URL HTTPS donde MP enviará POST de notificación de pago.
 * 1) MERCADOPAGO_NOTIFICATION_URL (+ opcional MERCADOPAGO_NOTIFICATION_URL_QUERY): Hub u otro webhook HTTPS.
 * 2) MERCADOPAGO_WEBHOOK_PUBLIC_BASE_URL + /api/mercadopago/webhook
 * 3) NEXT_PUBLIC_APP_URL + /api/... si es https
 */
function resolveMpNotificationUrl(appBaseUntrimmed: string): string | undefined {
  const appBase = appBaseUntrimmed.trim().replace(/\/+$/, '');
  const full = process.env.MERCADOPAGO_NOTIFICATION_URL?.trim();
  if (full?.startsWith('https://')) {
    let url = normalizeHttpsWebhookUrl(full);
    url = mergeNotificationUrlQuery(url, process.env.MERCADOPAGO_NOTIFICATION_URL_QUERY);
    return url;
  }
  const explicit = process.env.MERCADOPAGO_WEBHOOK_PUBLIC_BASE_URL?.trim().replace(/\/+$/, '');
  if (explicit?.startsWith('https://')) {
    return `${explicit}/api/mercadopago/webhook`;
  }
  if (appBase.startsWith('https://')) {
    return `${appBase}/api/mercadopago/webhook`;
  }
  return undefined;
}

/** Evita URLs inválidas si NEXT_PUBLIC_* trae espacios desde la consola Firebase. */
function publicAppBaseUrl(): string {
  return String(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:9006')
    .trim()
    .replace(/\/+$/, '');
}

// Función para crear preferencia de pago
export async function createPaymentPreference(data: CreatePreferenceData): Promise<MercadoPagoPreference> {
  try {
    console.log('🌍 Mercado Pago env:', process.env.MERCADOPAGO_ENVIRONMENT?.trim() || 'default');
    console.log('📦 Data recibida:', data);

    const appBase = publicAppBaseUrl();
    const returnUrl = `${appBase}/dashboard/billetera`;
    // Producción de MP exige HTTPS para back_urls cuando se usa auto_return; con http:// (p. ej. local) falla con invalid_auto_return.
    const canAutoReturn = returnUrl.startsWith('https://');
    const notificationUrl = resolveMpNotificationUrl(appBase);
    if (notificationUrl) {
      console.log('🔔 notification_url preferencia:', notificationUrl);
    }

    const payerDni =
      typeof data.payerDniDigits === 'string' && /^\d{6,12}$/.test(data.payerDniDigits)
        ? data.payerDniDigits
        : '12345678';

    const hubPeriodo = new Date().toISOString().slice(0, 7);
    const hubConcepto = truncateHubField(
      `${data.planName} — ${data.credits} envios`,
      120,
    );

    const billingRaw =
      typeof data.hubBillingClientDocId === 'string' && data.hubBillingClientDocId.trim()
        ? data.hubBillingClientDocId.trim()
        : data.userId;
    const billingSuffix =
      billingRaw
        .replace(/^\/+|\/+$/g, '')
        .replace(/^(billing_clients\/)+/i, '') || data.userId;

    const hubMetadata: Record<string, string> = {
      hub_emit_factura: hubEmitFacturaFromEnv(),
      hub_app_id: NOTIFICAS_HUB_APP_ID,
      hub_cliente_id: `billing_clients/${billingSuffix}`,
      hub_concepto: hubConcepto,
      hub_pedido_id: data.transactionId,
      hub_plan: data.planId,
      hub_periodo: hubPeriodo,
    };

    const cbte = data.hubCbteTipo?.trim().toUpperCase();
    if (cbte === 'A' || cbte === 'B' || cbte === 'C') {
      hubMetadata.hub_cbte_tipo = cbte;
    }
    const cuit = data.hubCuitCompradorDigits?.replace(/\D/g, '') ?? '';
    if (cuit.length === 11) {
      hubMetadata.hub_cuit_comprador = cuit;
    }
    if (data.hubRazonSocial?.trim()) {
      hubMetadata.hub_razon_social = truncateHubField(data.hubRazonSocial.trim(), 100);
    }

    const preferenceData = {
      items: [
        {
          id: data.planId,
          title: data.planName,
          description: `Compra de ${data.credits} envíos para notificaciones certificadas`,
          quantity: 1,
          unit_price: data.price,
          currency_id: 'ARS'
        }
      ],
      payer: {
        email: data.userEmail,
        identification: {
          type: 'DNI',
          number: payerDni
        }
      },
      payment_methods: {
        excluded_payment_methods: [],
        excluded_payment_types: [],
        installments: 12
      },
      back_urls: {
        success: returnUrl,
        failure: returnUrl,
        pending: returnUrl,
      },
      ...(canAutoReturn ? { auto_return: 'approved' as const } : {}),
      ...(notificationUrl ? { notification_url: notificationUrl } : {}),
      external_reference: buildHubExternalReference(data.transactionId),
      metadata: {
        ...hubMetadata,
        plan_id: data.planId,
        user_id: data.userId,
        credits: data.credits.toString(),
        ...(data.listPrice != null && data.colegioDiscountPercent != null && data.colegioDiscountPercent > 0
          ? {
              list_price: String(data.listPrice),
              colegio_discount_percent: String(data.colegioDiscountPercent),
            }
          : {}),
      }
    };

    const preference = createPreferenceClient();
    const response = await preference.create({ body: preferenceData });
    
    return {
      id: response.id!,
      init_point: response.init_point!,
      sandbox_init_point: response.sandbox_init_point!
    };
  } catch (error) {
    const detail =
      error && typeof error === 'object' && 'message' in error
        ? String((error as { message: unknown }).message)
        : String(error);
    console.error('Error creating MercadoPago preference:', detail, error);
    throw new Error(`Error al crear la preferencia de pago: ${detail}`);
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
