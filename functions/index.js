const { onRequest } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onObjectFinalized } = require('firebase-functions/v2/storage');
const { defineSecret, defineString } = require('firebase-functions/params');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const cheerio = require('cheerio');
const { generateEmailWithTracking } = require('./email-template');
const { injectTrackingIntoHtml: injectTrackingIntoHtmlImpl } = require('./tracking-html');
const {
  looksLikeBouncePayload,
  applyEmailBounce,
  applyEmailBounceFromPayload,
} = require('./email-bounce');

initializeApp();

// Permite escribir docs/arrays con campos undefined sin que Firestore rechace el update.
// Crítico para tracking.movements: documentos viejos pueden contener undefined heredado, y al
// re-escribir el array (spread) el admin SDK valida todos los elementos contra esta regla.
try {
  getFirestore().settings({ ignoreUndefinedProperties: true });
} catch (e) {
  // settings() ya aplicado en una invocación previa de la misma instancia (warm). Ignorar.
}

// Secrets de WhatsApp en Secret Manager (firebase functions:secrets:set)
const whatsappAccessToken = defineSecret('WHATSAPP_ACCESS_TOKEN');
const whatsappPhoneNumberId = defineSecret('WHATSAPP_PHONE_NUMBER_ID');
// Secret SMTP (firebase functions:secrets:set SMTP_PASS)
const smtpPass = defineSecret('SMTP_PASS');
// Mismo valor que App Hosting POLYGON_CERTIFY_SECRET — protege /api/polygon/certify-event
const polygonCertifySecret = defineSecret('POLYGON_CERTIFY_SECRET');
const campaignWorkerSecret = defineSecret('CAMPAIGN_WORKER_SECRET');
// Token de verificación del webhook de WhatsApp (se define en Meta Developer Portal)
const whatsappVerifyToken = defineSecret('WHATSAPP_VERIFY_TOKEN');
// App Secret de Meta (firma X-Hub-Signature-256 del webhook)
const whatsappAppSecret = defineSecret('WHATSAPP_APP_SECRET');
// Template aprobado en Meta (requerido para contactar usuarios fuera de ventana 24h)
const whatsappTemplateName = defineString('WHATSAPP_TEMPLATE_NAME', { default: 'notificaciones_notificas' });
const whatsappTemplateLanguage = defineString('WHATSAPP_TEMPLATE_LANGUAGE', { default: 'es_AR' });

function usesNotificasDefaultTemplate(name) {
  const n = String(name || '').trim().toLowerCase();
  return !n || n === 'notificaciones_notificas';
}

function resolveCampaignWhatsAppTemplate(emailData) {
  const campaignName = String(emailData?.waTemplateName || '').trim();
  const globalName = whatsappTemplateName.value()?.trim() || 'notificaciones_notificas';
  const useDefault = usesNotificasDefaultTemplate(campaignName);
  return {
    templateName: useDefault ? globalName : campaignName,
    templateLang: String(emailData?.waTemplateLang || '').trim() || whatsappTemplateLanguage.value()?.trim() || 'es_AR',
    templateVariables: useDefault ? null : (Array.isArray(emailData?.waTemplateVariables) ? emailData.waTemplateVariables : null),
    urlButton: useDefault ? false : emailData?.waUrlButton === true,
  };
}

/**
 * Dígitos E.164 argentinos sin `+` (ej. 5491112345678).
 *
 * SYNC: la lógica DEBE mantenerse igual a `toWhatsAppPhone` en
 * src/lib/parse-campaign-csv.ts (allá se guarda con `+`; acá sin `+` para Meta).
 * Si cambia una, cambiar la otra. Plan futuro: extraer a un paquete compartido
 * (hoy Next.js y Cloud Functions no comparten módulos).
 */
function formatPhoneForWhatsApp(phone) {
  if (!phone || typeof phone !== 'string') return null;
  let digits = phone.replace(/\D/g, '');
  if (digits.length < 8) return null;
  if (digits.startsWith('0')) digits = digits.slice(1);
  let result;
  if (digits.startsWith('54')) {
    if (digits.startsWith('549') && digits.length >= 12) result = digits;
    else if (digits[2] === '9') result = digits;
    else result = '549' + digits.slice(2);
  } else if (digits.startsWith('9') && digits.length === 11) {
    result = '54' + digits;
  } else {
    result = '549' + digits;
  }
  return result.length >= 10 ? result : null;
}

/** Nombre para saludo WA: evita "Hola usuario123" cuando solo hay handle o email. */
function formatWhatsAppRecipientDisplay(recipientName) {
  const r = (recipientName || '').trim();
  if (!r || r.toLowerCase() === 'usuario') return 'destinatario/a';
  if (r.includes('@')) return 'destinatario/a';
  if (/\s/.test(r)) return r.substring(0, 50);
  return 'destinatario/a';
}

/** Si solo hay correo, redactar en tercera persona; si hay nombre, usarlo. Límite 50 por variable Meta. */
function formatWhatsAppSenderDisplay(senderName, fromEmail) {
  const s = (senderName || '').trim();
  const from = (fromEmail || '').trim();
  const email = s.includes('@') ? s : from;
  if (s && !s.includes('@')) return s.substring(0, 50);
  if (email) {
    const label = `el remitente (${email})`;
    return label.length <= 50 ? label : email.substring(0, 50);
  }
  return 'Notificas.com';
}

/**
 * Plantilla Meta (3 variables): {{1}} destinatario, {{2}} remitente, {{3}} URL.
 * Sugerencia de cuerpo para alinear con el mensaje libre:
 * "Estimado/a {{1}},\n\nLe informamos que {{2}} le ha enviado una notificación digital certificada a través de Notificas.com.\n\nAcceda al contenido aquí:\n{{3}}\n\nSi no reconoce este envío, ignore este mensaje. Consultas: contacto@notificas.com\n\n— Notificas.com"
 */
/**
 * @param {object} opts
 * @param {string} opts.accessToken
 * @param {string} opts.phoneNumberId
 * @param {string|null} opts.templateName  - nombre del template aprobado en Meta
 * @param {string} opts.templateLang
 * @param {string} opts.toPhone
 * @param {string} opts.readerUrl          - URL del lector de la notificación
 * @param {string} opts.senderName
 * @param {string} opts.recipientName
 * @param {string[]|null} opts.templateVariables - campos del destinatario en orden: ['nombre','dni',...]
 * @param {object} opts.recipientData      - datos del destinatario para resolver variables
 */
function resolveWhatsAppTemplateValue(field, rd, recipientName, toPhone, readerUrl, senderName) {
  switch (field) {
    case 'nombre':       return rd.nombre || recipientName || '';
    case 'dni':          return rd.dni || '';
    case 'legajo':       return rd.legajo || '';
    case 'email':        return rd.email || '';
    case 'telefono':     return rd.telefono || toPhone || '';
    case 'dias':
    case 'dias_atraso':  return rd.dias || rd.dias_atraso || '';
    case 'remitente':
    case 'empresa':      return senderName || '';
    case 'url_lectura':
    case 'boton_url':    return readerUrl;
    default:             return rd[field] || '';
  }
}

function readerUrlButtonSuffix(readerUrl) {
  try {
    const u = new URL(readerUrl);
    return `${u.pathname}${u.search}`;
  } catch {
    return readerUrl || '';
  }
}

async function sendWhatsAppNotification({ accessToken, phoneNumberId, templateName, templateLang, toPhone, readerUrl, senderName, recipientName, templateVariables, recipientData, urlButton }) {
  if (!accessToken || !phoneNumberId) {
    console.warn('⚠️ WhatsApp: secrets no configurados en Secret Manager');
    return null;
  }
  const to = formatPhoneForWhatsApp(toPhone);
  if (!to) {
    console.warn('⚠️ Teléfono WhatsApp inválido:', toPhone);
    return null;
  }

  const url = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`;
  let payload;
  let parameters = null;
  let buttonParameters = null;
  if (templateName) {
    // Resolver variables del template según campaignTemplateVariables
    // Si hay templateVariables custom, usarlas; si no, fallback a [destinatario, remitente, url]
    const rd = recipientData || {};
    // Array (aunque vacío) = mapping explícito de la campaña. null/undefined = fallback legacy.
    const hasCustomVars = Array.isArray(templateVariables);
    const bodyFields = hasCustomVars
      ? templateVariables.filter((field) => !(urlButton && (field === 'url_lectura' || field === 'boton_url')))
      : null;
    if (bodyFields) {
      parameters = bodyFields.map((field) => ({
        type: 'text',
        text: String(resolveWhatsAppTemplateValue(field, rd, recipientName, toPhone, readerUrl, senderName)).substring(0, 1024),
      }));
    } else if (!urlButton) {
      // Fallback legacy: {{1}} destinatario, {{2}} remitente, {{3}} url
      parameters = [
        { type: 'text', text: recipientName.substring(0, 50) },
        { type: 'text', text: senderName.substring(0, 50) },
        { type: 'text', text: readerUrl },
      ];
    } else {
      parameters = [];
    }
    const emptyParam = parameters.findIndex((p) => !String(p.text || '').trim());
    if (emptyParam >= 0) {
      const fieldLabel = bodyFields ? bodyFields[emptyParam] : ['nombre', 'remitente', 'url'][emptyParam];
      return {
        error: {
          code: 131008,
          message: `(#131008) Variable {{${emptyParam + 1}}} (${fieldLabel || 'texto'}) está vacía. Meta no acepta parámetros vacíos. Quitá esa variable o completá el dato del destinatario.`,
        },
      };
    }
    const components = [];
    if (parameters.length > 0) {
      components.push({ type: 'body', parameters });
    }
    if (urlButton) {
      buttonParameters = [{ type: 'text', text: readerUrlButtonSuffix(readerUrl).substring(0, 2000) }];
      components.push({
        type: 'button',
        sub_type: 'url',
        index: '0',
        parameters: buttonParameters,
      });
    }
    payload = {
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name: templateName,
        language: { code: templateLang || 'es_AR' },
        components,
      },
    };
  } else {
    const body = `Estimado/a ${recipientName},

Le informamos que ${senderName} le ha enviado una notificación digital certificada a través de Notificas.com.

Acceda al contenido desde el siguiente enlace:
${readerUrl}

Si no reconoce este envío, puede ignorar este mensaje. Consultas: contacto@notificas.com

— Notificas.com`;
    payload = {
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body }
    };
  }

  const MAX_ATTEMPTS = 4;
  const BASE_DELAY_MS = 1000;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let res, data;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      data = await res.json();
    } catch (err) {
      console.error(`❌ WhatsApp fetch error (intento ${attempt}/${MAX_ATTEMPTS}):`, err.message);
      if (attempt === MAX_ATTEMPTS) return { error: { message: err.message } };
      await new Promise(r => setTimeout(r, BASE_DELAY_MS * Math.pow(2, attempt - 1)));
      continue;
    }

    if (res.ok) {
      console.log('📱 WhatsApp enviado:', data.messages?.[0]?.id);
      return {
        id: data.messages?.[0]?.id,
        requestSnapshot: {
          to,
          type: payload.type,
          templateName: payload.template?.name || null,
          templateLang: payload.template?.language?.code || null,
          parameters: parameters || payload.template?.components?.find((c) => c.type === 'body')?.parameters || null,
          buttons: typeof buttonParameters !== 'undefined' ? buttonParameters : null,
          bodyText: payload.text?.body || null,
          readerUrl,
        },
        graphResponse: {
          messaging_product: data.messaging_product || 'whatsapp',
          contacts: data.contacts || null,
          messages: data.messages || null,
        },
      };
    }

    const errorCode = data?.error?.code;
    const isRateLimit = res.status === 429 || errorCode === 130429 || errorCode === 131056;
    const isServerError = res.status >= 500;
    const isRetryable = isRateLimit || isServerError;

    console.error(`❌ WhatsApp API error (intento ${attempt}/${MAX_ATTEMPTS}): HTTP ${res.status} código ${errorCode}`, JSON.stringify(data?.error));

    if (!isRetryable || attempt === MAX_ATTEMPTS) {
      return { error: data };
    }

    // Respetar Retry-After de Meta si viene en el header; si no, backoff exponencial.
    const retryAfterSec = parseInt(res.headers.get('Retry-After') || '0', 10);
    const delayMs = retryAfterSec > 0
      ? retryAfterSec * 1000
      : BASE_DELAY_MS * Math.pow(2, attempt - 1);

    console.warn(`⏳ WhatsApp rate limit / error servidor — esperando ${delayMs}ms antes del intento ${attempt + 1}`);
    await new Promise(r => setTimeout(r, delayMs));
  }

  return { error: { message: 'Max reintentos WhatsApp alcanzado' } };
}

const REGION = 'us-central1';
const PROJECT_ID = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || 'notificas-f9953';
const FIREBASE_STORAGE_BUCKET =
  process.env.FIREBASE_STORAGE_BUCKET || 'notificas-f9953.firebasestorage.app';
const EVIDENCE_STORAGE_BUCKET =
  process.env.EVIDENCE_STORAGE_BUCKET || 'notificas-f9953-evidence';
const LINK_REDIRECT_URL = 'https://linkredirect-ju7n3yysfq-uc.a.run.app';
const CONFIRM_READ_URL = 'https://confirmread-ju7n3yysfq-uc.a.run.app';
// IMPORTANTE: Siempre usar la URL de producción para los enlaces en correos
// Incluso en desarrollo local, los correos deben apuntar a la URL pública
// para que los destinatarios puedan acceder correctamente
// NUNCA usar localhost aquí, ya que los correos se envían a usuarios reales
const PRODUCTION_URL = 'https://notificas--notificas-f9953.us-central1.hosted.app';
const APP_HOSTING_URL = (() => {
  const url = process.env.APP_HOSTING_URL || PRODUCTION_URL;
  // Validación: asegurar que nunca se use localhost en producción
  if (url.includes('localhost') || url.includes('127.0.0.1') || url.includes(':9006')) {
    console.warn('⚠️ ADVERTENCIA: Se detectó localhost en APP_HOSTING_URL, usando URL de producción');
    return PRODUCTION_URL;
  }
  console.log(`✅ APP_HOSTING_URL configurado: ${url}`);
  return url;
})();

/** Init para fetch a App Hosting /api/polygon/certify-event (X-Certify-Secret si está definido el secret). */
function certifyEventFetchInit(body) {
  const headers = { 'Content-Type': 'application/json' };
  const secret = polygonCertifySecret.value();
  if (secret) headers['X-Certify-Secret'] = secret;
  return { method: 'POST', headers, body: JSON.stringify(body) };
}

function getCertifyRecipientId(data) {
  return (
    data?.recipientEmail ||
    (Array.isArray(data?.to) ? data.to[0] : data?.to) ||
    'recipient'
  );
}

function certifyPolygonEventOnce(docId, data, type, context, via) {
  if (data?.campaignId) return;
  if (!docId) return;

  const fieldByType = {
    receive: 'receive',
    read: 'read',
    whatsapp: 'whatsapp',
    wa_payload: 'whatsapp',
    wa_delivered: 'waDelivered',
    wa_read: 'waRead',
    content_access: 'contentAccess',
    read_confirmed: 'readConfirmed',
  };
  const field = fieldByType[type];
  if (!field) return;
  if (data?.polygonCertifications?.[field]) {
    console.log(`🔗 Polygon ${type} ya certificado (${context})`);
    return;
  }

  const certifyUrl = `${APP_HOSTING_URL}/api/polygon/certify-event`;
  const body = { docId: String(docId), type, userId: getCertifyRecipientId(data) };
  if (via) body.via = via;
  void fetch(certifyUrl, certifyEventFetchInit(body))
    .then(async (certifyRes) => {
      if (!certifyRes.ok) {
        console.warn(`⚠️ Polygon certify ${type} (${context}):`, await certifyRes.text());
      }
    })
    .catch((e) => console.warn(`⚠️ Polygon certify ${type} failed (${context}):`, e?.message));
}

// Función para extraer información del navegador del User-Agent
function extractBrowserInfo(userAgent) {
  if (!userAgent) return 'Unknown';
  
  // Detectar navegadores comunes
  if (userAgent.includes('Chrome/')) {
    const match = userAgent.match(/Chrome\/(\d+\.\d+\.\d+\.\d+)/);
    return match ? `Chrome v${match[1]}` : 'Chrome';
  }
  if (userAgent.includes('Firefox/')) {
    const match = userAgent.match(/Firefox\/(\d+\.\d+)/);
    return match ? `Firefox v${match[1]}` : 'Firefox';
  }
  if (userAgent.includes('Safari/') && !userAgent.includes('Chrome')) {
    const match = userAgent.match(/Version\/(\d+\.\d+)/);
    return match ? `Safari v${match[1]}` : 'Safari';
  }
  if (userAgent.includes('Edge/')) {
    const match = userAgent.match(/Edge\/(\d+\.\d+\.\d+\.\d+)/);
    return match ? `Edge v${match[1]}` : 'Edge';
  }
  if (userAgent.includes('Opera/')) {
    const match = userAgent.match(/Opera\/(\d+\.\d+)/);
    return match ? `Opera v${match[1]}` : 'Opera';
  }
  
  return 'Unknown Browser';
}

const DEFAULT_FROM_EMAIL = 'contacto@notificas.com';
const DEFAULT_FROM_DISPLAY_NAME = 'Notificas';

/** Nombre visible en bandeja de entrada: "Notificas" en lugar de "contacto". */
function formatSmtpFrom(email, displayName = DEFAULT_FROM_DISPLAY_NAME) {
  const addr = (email || DEFAULT_FROM_EMAIL).trim();
  if (/^[^<]+<[^>]+>$/.test(addr)) return addr;
  const name = (displayName || DEFAULT_FROM_DISPLAY_NAME).trim();
  return `${name} <${addr}>`;
}

// El transporter se crea de forma lazy para acceder al secret en runtime
function getTransporter() {
  const pass = smtpPass.value();
  if (!pass) throw new Error('SMTP_PASS secret no configurado. Ejecutar: firebase functions:secrets:set SMTP_PASS');
  return nodemailer.createTransport({
    host: 'vps-1711372-x.dattaweb.com',
    port: 465,
    secure: true,
    auth: {
      user: 'contacto@notificas.com',
      pass,
    },
  });
}

function generateToken() {
  return crypto.randomBytes(16).toString('hex');
}

function base64UrlEncode(str) {
  return Buffer.from(str, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function base64UrlDecode(str) {
  return Buffer.from(str.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
}

/**
 * Wrapper que delega en `./tracking-html.js` (módulo testeable) pasándole las URLs
 * de tracking definidas en este archivo, y loggea las estadísticas de procesamiento.
 */
function injectTrackingIntoHtml(html, docId, token) {
  if (!html) return html;
  const { html: out, stats } = injectTrackingIntoHtmlImpl(html, docId, token, {
    linkRedirectUrl: LINK_REDIRECT_URL,
    appHostingUrl: APP_HOSTING_URL,
  });
  console.log(
    `🔗 Tracking: ${stats.processedCount} enlaces procesados, ${stats.replacedCount} enlaces inválidos reemplazados, ${stats.ignoredCount} ignorados (mailto/tel/js)`
  );
  return out;
}





function whatsappErrorMessage(waId) {
  if (!waId) return 'La API de WhatsApp no devolvió un ID de mensaje';
  if (typeof waId === 'string') return null;
  if (waId.id && typeof waId.id === 'string') return null;
  const err = waId.error || waId;
  const nested = err.error || err;
  const code = nested.code || err.code;
  const raw = nested.message || err.message || (typeof err === 'string' ? err : JSON.stringify(err));
  if (code === 131008 || /required parameter is missing/i.test(String(raw || ''))) {
    if (String(raw).includes('está vacía')) return raw;
    return `(#131008) Falta un parámetro del template de WhatsApp. Suele ser una variable {{N}} vacía, distinta cantidad que en Meta, o un botón URL no activado en la campaña.`;
  }
  if (code && !String(raw).includes(`#${code}`)) return `(#${code}) ${raw}`;
  return raw;
}

function whatsappResultId(waId) {
  if (!waId) return null;
  if (typeof waId === 'string') return waId;
  if (typeof waId.id === 'string') return waId.id;
  return null;
}

exports.sendEmail = onRequest(
  {
    region: REGION,
    concurrency: 1,
    // Techo bajo el MPS típico de Cloud API (~80). minInstances evita el cold start del primer lote.
    maxInstances: 40,
    minInstances: 1,
    secrets: [whatsappAccessToken, whatsappPhoneNumberId, smtpPass, polygonCertifySecret],
  },
  async (req, res) => {
    const timestamp = new Date().toISOString();
    console.log(`🔥 [${timestamp}] Firebase Function sendEmail ejecutada`);
    try {
      const expectedSecret = (polygonCertifySecret.value() || '').trim();
      if (expectedSecret) {
        const got = String(req.get('X-Certify-Secret') || req.get('x-certify-secret') || '').trim();
        if (got !== expectedSecret) {
          return res.status(401).json({ error: 'No autorizado' });
        }
      } else {
        console.warn('⚠️ POLYGON_CERTIFY_SECRET vacío — sendEmail sin auth (solo entorno local)');
      }

      const { docId } = req.body;
      console.log(`🔥 [${timestamp}] Procesando docId:`, docId);
      
      if (!docId) {
        return res.status(400).json({ error: 'docId es requerido' });
      }
      
      const db = getFirestore();
      const docRef = db.doc(`mail/${docId}`);
      const docSnapshot = await docRef.get();
      
      if (!docSnapshot.exists) {
        return res.status(404).json({ error: 'Documento no encontrado' });
      }
      
      const emailData = docSnapshot.data();

      if (emailData.simulated === true) {
        console.log(`🧪 sendEmail ignorado (simulación) docId=${docId}`);
        return res.status(200).json({ success: true, simulated: true, message: 'Campaña simulada: no se envía' });
      }
      
      const alreadyDelivered = emailData.delivery?.state === 'DELIVERED';
      const waRequired = emailData.waOnly === true || Boolean(emailData.campaignId && emailData.recipientPhone);
      const existingWamid = emailData.whatsappMessageId || emailData.tracking?.whatsappMessageId;
      // DELIVERED + (email-only, o WA ya con WAMID) → idempotente.
      // ERROR se reintenta. DELIVERED sin WAMID en campaña WA → reintenta solo WhatsApp.
      if (alreadyDelivered && (!waRequired || existingWamid)) {
        console.log(`⚠️ Documento ${docId} ya fue procesado, estado:`, emailData.delivery.state);
        return res.status(200).json({
          success: true,
          message: 'Ya fue procesado',
          state: emailData.delivery.state,
        });
      }

    /* Formulario Contáctenos: un solo correo simple por SMTP (sin plantilla certificada). */
    if (emailData.contactRequest === true) {
      const toRawCf = emailData.to;
      const toCf = Array.isArray(toRawCf) ? toRawCf.join(',') : toRawCf;
      const fromCf = emailData.from || 'contacto@notificas.com';
      const subjectCf = emailData.message?.subject || 'Consulta';
      const htmlCf = emailData.message?.html || '';
      const textCf =
        emailData.message?.text || String(htmlCf).replace(/<[^>]*>/g, '');
      const resultCf = await getTransporter().sendMail({
        from: formatSmtpFrom(fromCf),
        to: toCf,
        replyTo: emailData.replyTo,
        subject: subjectCf,
        html: htmlCf,
        text: textCf,
      });
      if (!resultCf.messageId) {
        throw new Error('No se recibió messageId del servidor de correo (contacto)');
      }
      await docRef.update({
        delivery: {
          state: 'DELIVERED',
          time: FieldValue.serverTimestamp(),
          info: resultCf.messageId
        },
        source: 'contact_form',
        sourceLabel: 'Formulario Contáctenos',
        sourceIcon: '📝'
      });
      console.log('📧 Contacto web enviado:', resultCf.messageId);
      return res.status(200).json({ success: true, messageId: resultCf.messageId });
    }

    const toRaw = emailData.to;
    const to = Array.isArray(toRaw) ? toRaw.join(',') : toRaw;
    const from = emailData.from || 'contacto@notificas.com';

    const trackingToken = emailData.tracking?.token || generateToken();

    // Campaña WhatsApp-only: enviar WA primero; DELIVERED solo si Meta aceptó.
    if (emailData.waOnly === true) {
      const waDigits = formatPhoneForWhatsApp(emailData.recipientPhone);
      const rParam =
        waDigits && waDigits.length >= 10
          ? `&r=${encodeURIComponent(base64UrlEncode(waDigits))}`
          : '';
      const readerUrlWa = `${APP_HOSTING_URL}/linkRedirect?msg=${encodeURIComponent(docId)}&k=${encodeURIComponent(trackingToken)}&src=whatsapp${rParam}`;
      const recipientPhone = emailData.recipientPhone;
      if (!recipientPhone) {
        await docRef.update({
          delivery: { state: 'ERROR', time: FieldValue.serverTimestamp(), error: 'Sin teléfono WhatsApp' },
        });
        return res.status(422).json({ success: false, error: 'Sin teléfono WhatsApp', channel: 'whatsapp-only' });
      }

      const token = whatsappAccessToken.value();
      const phoneId = whatsappPhoneNumberId.value();
      const waTpl = resolveCampaignWhatsAppTemplate(emailData);
      const waId = await sendWhatsAppNotification({
        accessToken: token, phoneNumberId: phoneId,
        templateName: waTpl.templateName, templateLang: waTpl.templateLang,
        toPhone: recipientPhone, readerUrl: readerUrlWa,
        senderName: formatWhatsAppSenderDisplay(emailData.senderName, from),
        recipientName: formatWhatsAppRecipientDisplay(emailData.recipientName),
        templateVariables: waTpl.templateVariables,
        urlButton: waTpl.urlButton,
        recipientData: {
          nombre: emailData.recipientName,
          email: emailData.recipientEmail,
          telefono: recipientPhone,
          dni: emailData.recipientDni,
          legajo: emailData.recipientLegajo,
          dias: emailData.recipientDias,
        },
      });
      const waErr = whatsappErrorMessage(waId);
      if (waErr) {
        console.error('❌ WhatsApp WA-only error:', waErr);
        await docRef.update({
          delivery: { state: 'ERROR', time: FieldValue.serverTimestamp(), error: waErr },
        });
        return res.status(502).json({ success: false, error: waErr, channel: 'whatsapp-only' });
      }

      const waOnlyId = whatsappResultId(waId);
      await docRef.update({
        delivery: { state: 'DELIVERED', time: FieldValue.serverTimestamp(), info: 'whatsapp-only' },
        tracking: {
          token: trackingToken,
          sentAt: FieldValue.serverTimestamp(),
          openCount: 0, clickCount: 0,
          opened: false, openedAt: null,
          readConfirmed: false, readConfirmedAt: null,
          movements: [],
        },
        readerUrl: readerUrlWa,
        whatsappMessageId: waOnlyId,
        waRequestSnapshot: waId.requestSnapshot || null,
        waGraphResponse: waId.graphResponse || null,
        source: 'whatsapp_campaign',
        sourceLabel: 'Campaña WhatsApp',
        sourceIcon: '📱',
      });
      try {
        certifyPolygonEventOnce(docId, emailData, 'whatsapp', 'sendEmail-wa-only');
        await getFirestore().doc(`whatsapp_ids/${waOnlyId}`).set({
          mailDocId: docId,
          recipientPhone: formatPhoneForWhatsApp(recipientPhone) || recipientPhone,
          createdAt: FieldValue.serverTimestamp(),
        });
      } catch (e) {
        console.warn('⚠️ Error guardando whatsapp_ids (waOnly):', e.message);
      }
      console.log('📱 WhatsApp WA-only enviado:', waOnlyId);
      return res.status(200).json({ success: true, channel: 'whatsapp-only', whatsappId: waOnlyId });
    }

    const subject = emailData.message?.subject || 'Sin asunto';
    const htmlOriginal = emailData.message?.html || '';
    const textOriginal = emailData.message?.text || htmlOriginal.replace(/<[^>]*>/g, '');

    // Build reader URL for explicit read and confidential viewing
    const readerUrl = `${APP_HOSTING_URL}/reader/${encodeURIComponent(docId)}?k=${encodeURIComponent(trackingToken)}`;

    // Build email with new template and inject tracking
    // Si hay HTML original con archivos adjuntos, usarlo; si no, usar template genérico
    let htmlWithTracking;
    if (htmlOriginal && htmlOriginal.trim()) {
      // Usar el HTML original que incluye los archivos adjuntos
      const $ = cheerio.load(htmlOriginal, { decodeEntities: false });

      // Opción A: Quitar contenido y adjuntos del email (solo link de acceso). El reader mostrará todo.
      $('[data-email-hide]').remove();
      $('.email-hide-content').remove(); // retrocompatibilidad
      $('[class*="email-hide-content"]').remove();

      // Reemplazar TODOS los placeholders de enlaces con el readerUrl real
      $('a[href="#"]').each((_, el) => {
        const $el = $(el);
        const text = $el.text().trim();
        
        // Botón "Acceder a la notificación" o "Leer Notificacion" (retrocompat)
        if (text.toLowerCase().includes('notificacion')) {
          $el.attr('href', readerUrl);
          $el.attr('target', '_blank');
          $el.attr('rel', 'noopener');
          if (!$el.hasClass('btn')) {
            $el.addClass('btn');
          }
        } else {
          // Para otros enlaces, simplemente reemplazar el href
          $el.attr('href', readerUrl);
        }
      });
      
      // Reemplazar href="#confirm" con readerUrl#confirm
      $('a[href="#confirm"]').attr('href', `${readerUrl}#confirm`);
      
      // Reemplazar cualquier otro href que empiece con "#" (excepto los que ya tienen URLs completas)
      $('a[href^="#"]').each((_, el) => {
        const $el = $(el);
        const href = $el.attr('href');
        if (href && href !== '#confirm' && !href.match(/^https?:\/\//i)) {
          $el.attr('href', readerUrl);
        }
      });
      
      // CRÍTICO: Reemplazar TODOS los enlaces que contengan localhost con la URL de producción
      $('a[href]').each((_, el) => {
        const $el = $(el);
        const href = $el.attr('href');
        if (href && (href.includes('localhost') || href.includes('127.0.0.1') || href.includes(':9006'))) {
          console.log(`⚠️ Reemplazando enlace con localhost: ${href} -> ${readerUrl}`);
          $el.attr('href', readerUrl);
        }
      });
      
      let htmlToProcess = $.html();
      // Quitar placeholder de contenido (comentario HTML - no se muestra en email, pero lo eliminamos por limpieza)
      htmlToProcess = htmlToProcess.replace(/<!--\s*CONTENT_PLACEHOLDER[^>]*-->/gi, '');

      // CRÍTICO: Reemplazo explícito del botón "Acceder a la notificación" y enlace fallback
      htmlToProcess = htmlToProcess.replace(
        /<a([^>]*)\s+href\s*=\s*["']#["']([^>]*)>[\s]*Acceder\s+a\s+la\s+notificaci[oó]n[\s]*<\/a>/gi,
        `<a$1 href="${readerUrl}"$2>Acceder a la notificación</a>`
      );
      htmlToProcess = htmlToProcess.replace(
        /<a([^>]*)href\s*=\s*["']#["']([^>]*)>\[El enlace se agregar[^\]]*\]<\/a>/gi,
        `<a$1 href="${readerUrl}"$2>${readerUrl}</a>`
      );
      
      // Verificar que no queden enlaces con href="#" usando múltiples métodos
      const $check = cheerio.load(htmlToProcess);
      const remainingHashLinks = $check('a[href="#"]').length;
      if (remainingHashLinks > 0) {
        console.log(`⚠️ Advertencia: Aún quedan ${remainingHashLinks} enlaces con href="#" después del reemplazo`);
      }
      
      // Reemplazo agresivo con regex para capturar TODOS los casos posibles de href="#"
      // Esto captura: href="#", href='#', href="# ", href='# ', etc.
      htmlToProcess = htmlToProcess.replace(/href\s*=\s*["']#["']/gi, `href="${readerUrl}"`);
      htmlToProcess = htmlToProcess.replace(/href\s*=\s*#/gi, `href="${readerUrl}"`);
      
      // CRÍTICO: Reemplazar TODOS los enlaces que contengan localhost con la URL de producción
      // Esto captura: href="http://localhost:9006/...", href='http://localhost:9006/...', etc.
      htmlToProcess = htmlToProcess.replace(/href\s*=\s*["']([^"']*localhost[^"']*)["']/gi, `href="${readerUrl}"`);
      htmlToProcess = htmlToProcess.replace(/href\s*=\s*["']([^"']*127\.0\.0\.1[^"']*)["']/gi, `href="${readerUrl}"`);
      htmlToProcess = htmlToProcess.replace(/href\s*=\s*["']([^"']*:9006[^"']*)["']/gi, `href="${readerUrl}"`);
      
      // Verificar una vez más después del reemplazo agresivo
      const $finalCheck = cheerio.load(htmlToProcess);
      const finalHashLinks = $finalCheck('a[href="#"]').length;
      const localhostLinks = $finalCheck('a[href*="localhost"], a[href*="127.0.0.1"], a[href*=":9006"]').length;
      
      if (finalHashLinks > 0) {
        console.log(`❌ Error crítico: Aún quedan ${finalHashLinks} enlaces con href="#" después de todos los reemplazos`);
        // Como último recurso, reemplazar directamente en el HTML usando cheerio
        $finalCheck('a[href="#"]').attr('href', readerUrl);
        htmlToProcess = $finalCheck.html();
      }
      
      if (localhostLinks > 0) {
        console.log(`❌ Error crítico: Aún quedan ${localhostLinks} enlaces con localhost después de todos los reemplazos`);
        // Reemplazar todos los enlaces con localhost
        $finalCheck('a[href*="localhost"], a[href*="127.0.0.1"], a[href*=":9006"]').attr('href', readerUrl);
        htmlToProcess = $finalCheck.html();
      }
      
      console.log(`✅ HTML procesado: ${finalHashLinks} enlaces con #, ${localhostLinks} enlaces con localhost`);

      // `data-email-hide` borra cuerpo + adjuntos del HTML guardado; el destinatario no llegaba a tener
      // enlaces «Ver documento» trackeables. Reinsertamos solo una lista visible de adjuntos (mismos fileUrl)
      // para que `injectTrackingIntoHtml` los envuelva con linkRedirect.
      if (Array.isArray(emailData.attachments) && emailData.attachments.length > 0) {
        const valid = emailData.attachments.filter(
          (att) => att && typeof att.fileUrl === 'string' && /^https?:\/\//i.test(att.fileUrl.trim()),
        );
        if (valid.length > 0) {
          const blocks = valid
            .map((att) => {
              const name = escapeHtmlTextEmail(att.fileName || 'Documento');
              /** `att` evita depender del match URL tras Safe Links / Gmail; `injectTrackingIntoHtml` no lo reemplaza. */
              const redirectAtt = `${LINK_REDIRECT_URL}?msg=${encodeURIComponent(docId)}&k=${encodeURIComponent(trackingToken)}&att=${encodeURIComponent(String(att.id))}`;
              const hrefEsc = escapeHrefAmpersands(redirectAtt);
              const ext = escapeHtmlTextEmail(String(att.fileName || '').split('.').pop() || 'DOC').toUpperCase();
              return `<div style="margin-bottom:12px;padding:12px;background:#ffffff;border:1px solid #e2e8f0;border-radius:6px;">
                <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
                  <div style="width:40px;height:40px;background:#dc2626;border-radius:6px;display:flex;align-items:center;justify-content:center;">
                    <span style="color:white;font-weight:bold;font-size:12px;">${ext}</span>
                  </div>
                  <div style="flex:1;min-width:140px;">
                    <strong style="color:#1e293b;font-size:14px;">${name}</strong>
                  </div>
                  <a href="${hrefEsc}" style="background:#0D9488;color:white;padding:8px 16px;border-radius:6px;text-decoration:none;font-size:12px;font-weight:600;display:inline-block;">Ver documento</a>
                </div>
              </div>`;
            })
            .join('');
          const outer = `<div style="margin:24px 0;padding:16px;background:#f8fafc;border-radius:8px;border-left:4px solid #0D9488;">
            <h2 style="color:#1e293b;margin:0 0 8px 0;font-size:18px;font-weight:600;">📎 Documentos adjuntos (${valid.length})</h2>
            <p style="margin:0 0 12px 0;color:#64748b;font-size:13px;line-height:1.5;">Descargue o visualice cada archivo desde este correo. El acceso queda registrado como constancia en la notificación.</p>
            ${blocks}
          </div>`;
          const $inj = cheerio.load(htmlToProcess, { decodeEntities: false });
          if ($inj('body').length) {
            $inj('body').append(outer);
          } else {
            $inj.root().append(outer);
          }
          htmlToProcess = $inj.html();
        }
      }

      htmlWithTracking = injectTrackingIntoHtml(htmlToProcess, docId, trackingToken);
      console.log('📎 Usando HTML original con archivos adjuntos');
    } else {
      // Usar template genérico si no hay HTML original
      htmlWithTracking = generateEmailWithTracking({
        senderName: emailData.senderName || from || 'Notificas',
        recipientName: emailData.recipientName || 'Usuario',
        recipientEmail: emailData.recipientEmail || '',
        readUrl: readerUrl,
        fallbackUrl: readerUrl,
        year: new Date().getFullYear(),
        docId: docId,
        trackingToken: trackingToken,
        linkRedirectUrl: LINK_REDIRECT_URL
      });
      console.log('📧 Usando template genérico');
    }



      // Generar versión de texto plano completa con toda la información
      const textVersion = `NOTIFICACION
Nueva comunicacion para usted
Enviada por ${emailData.senderName || from} mediante Notificas.com

Estimado/a ${emailData.recipientName || 'Usuario'},

Ha recibido una comunicacion fehaciente digital remitida por ${emailData.senderName || from}. Le recomendamos acceder a su contenido, ya que puede ser relevante para:

- Responder en tiempo y forma.
- Ejercer sus derechos y dejar constancia tecnica de acceso.
- Conservar evidencia de recepcion y lectura.

Leer Notificacion: ${readerUrl}

Si el boton no funciona, copie y pegue este enlace en su navegador:
${readerUrl}

La notificacion, sus metadatos de envio, recepcion y lectura quedan certificados y registrados en la red Blockchain a traves de Notificas.com. Esta constancia tecnica no implica conformidad con el contenido.

Para dejar constancia de que ha accedido al mensaje, puede utilizar el siguiente enlace:
Confirmar lectura: ${readerUrl}

${new Date().getFullYear()} Notificas.com
Este mensaje fue destinado a ${emailData.recipientEmail || to}. Si no reconoce esta notificacion, ignore este correo o responda a contacto@notificas.com.`;

      const mailOptions = {
        from: formatSmtpFrom(from),
        to,
        subject,
        text: textVersion,
        html: htmlWithTracking,
        replyTo: emailData.replyTo,
        cc: emailData.cc,
        bcc: emailData.bcc,
        headers: { 'X-Notificas-Mail-Id': docId },
      };

      let result = { messageId: emailData.smtpMessageId || emailData.delivery?.info || '' };

      if (!alreadyDelivered) {
      console.log('📧 Enviando email a:', to);
      console.log('📧 Asunto:', subject);
      result = await getTransporter().sendMail(mailOptions);
      
      console.log('📧 Resultado del envío:', result);
      
      // Verificar que el email se envió correctamente
      if (!result.messageId) {
        console.error('❌ Error: No se recibió messageId del servidor de correo');
        throw new Error('No se recibió messageId del servidor de correo');
      }

      // Crear movimiento inicial de envío
      const destinatarioEtiqueta =
        (emailData.recipientEmail && String(emailData.recipientEmail).trim()) ||
        (Array.isArray(toRaw) ? toRaw[0] : toRaw) ||
        String(to);

      const initialMovement = {
        id: crypto.randomUUID(),
        type: 'email_sent',
        description: `Envío certificado exclusivo para destinatario: ${destinatarioEtiqueta}`,
        timestamp: new Date().toISOString(),
        userAgent: 'Server',
        clientIP: 'Server',
        forwardedIPs: [],
        realIP: 'Server',
        browser: 'Server',
        recipientEmail: destinatarioEtiqueta
      };

      // CRÍTICO: NO actualizar el campo message - preservar message.content y attachments
      // que el compose guardó para que el reader muestre el contenido real al destinatario
      await docRef.update({
        delivery: {
          state: 'DELIVERED',
          time: FieldValue.serverTimestamp(),
          info: result.messageId
        },
        // smtpMessageId guardado en campo raíz para que certify-event lo incluya en la TX de Polygon
        smtpMessageId: result.messageId,
        smtpAccepted: {
          messageId: result.messageId || null,
          accepted: result.accepted || null,
          rejected: result.rejected || null,
          response: result.response || null,
          envelope: result.envelope || null,
        },
        tracking: {
          token: trackingToken,
          sentAt: FieldValue.serverTimestamp(),
          openCount: 0,
          clickCount: 0,
          opened: false,
          openedAt: null,
          readConfirmed: false,
          readConfirmedAt: null,
          messageId: result.messageId,
          movements: [initialMovement]
        },
        readerUrl,
        source: 'app_web', // Marcar como correo enviado desde la aplicación web
        sourceLabel: 'Enviado desde la app',
        sourceIcon: '💻'
      });

      console.log('Email enviado:', result.messageId);

      const rejected = Array.isArray(result.rejected) ? result.rejected.filter(Boolean) : [];
      if (rejected.length) {
        await applyEmailBounce(getFirestore(), {
          mailId: docId,
          smtpMessageId: result.messageId,
          type: 'smtp_rejected',
          reason: `SMTP rechazó el destinatario: ${rejected.join(', ')}`,
          recipient: String(rejected[0] || emailData.recipientEmail || ''),
          raw: { rejected, accepted: result.accepted || null, response: result.response || null },
        });
      }

      // Campañas: la hoja Merkle se registra en el worker (evita 1 TX por destinatario).
      if (!emailData.campaignId) {
        void fetch(`${APP_HOSTING_URL}/api/polygon/certify-event`, certifyEventFetchInit({
          docId: docId,
          type: 'send',
          userId: emailData.createdBy || from,
        }))
          .then(async (certRes) => {
            if (!certRes.ok) console.warn('⚠️ Polygon certify send:', await certRes.text());
            else console.log('✅ Envío certificado en Polygon (automático)');
          })
          .catch((e) => console.warn('⚠️ Polygon certify send failed (no afecta el envío):', e?.message));
      }

      } // !alreadyDelivered: no reenviar SMTP en retry de WhatsApp

      // Enviar WhatsApp si hay teléfono (secrets desde Secret Manager)
      const recipientPhone = emailData.recipientPhone;
      let whatsappId = null;
      let whatsappError = null;
      if (recipientPhone) {
        console.log('📱 Intentando WhatsApp a:', recipientPhone);
        try {
          const token = whatsappAccessToken.value();
          const phoneId = whatsappPhoneNumberId.value();
          if (!token || !phoneId) {
            whatsappError = 'Secrets WHATSAPP_ACCESS_TOKEN o WHATSAPP_PHONE_NUMBER_ID no configurados';
            console.warn('⚠️', whatsappError);
          } else {
            const waTpl = resolveCampaignWhatsAppTemplate(emailData);
            const whatsappLink = (() => {
              const waDigits = formatPhoneForWhatsApp(recipientPhone);
              const rParam =
                waDigits && waDigits.length >= 10
                  ? `&r=${encodeURIComponent(base64UrlEncode(waDigits))}`
                  : '';
              return `${APP_HOSTING_URL}/linkRedirect?msg=${encodeURIComponent(docId)}&k=${encodeURIComponent(trackingToken)}&src=whatsapp${rParam}`;
            })();
            const waRecipient = formatWhatsAppRecipientDisplay(emailData.recipientName);
            const waSender = formatWhatsAppSenderDisplay(emailData.senderName || from, from);
            const resultWA = await sendWhatsAppNotification({
              accessToken: token,
              phoneNumberId: phoneId,
              templateName: waTpl.templateName,
              templateLang: waTpl.templateLang,
              toPhone: recipientPhone,
              readerUrl: whatsappLink,
              senderName: waSender,
              recipientName: waRecipient,
              templateVariables: waTpl.templateVariables,
              urlButton: waTpl.urlButton,
              recipientData: {
                nombre: emailData.recipientName || '',
                email: emailData.recipientEmail || '',
                telefono: recipientPhone,
                dni: emailData.recipientDni || '',
                legajo: emailData.recipientLegajo || '',
                dias: emailData.recipientDias || '',
              },
            });
            const waResultId = whatsappResultId(resultWA);
            if (waResultId) {
              whatsappId = waResultId;
              if (resultWA.requestSnapshot) {
                try {
                  await docRef.update({
                    waRequestSnapshot: resultWA.requestSnapshot,
                    waGraphResponse: resultWA.graphResponse || null,
                  });
                } catch (e) {
                  console.warn('⚠️ Error guardando waRequestSnapshot:', e.message);
                }
              }
              certifyPolygonEventOnce(docId, emailData, 'whatsapp', 'sendEmail-wa');
              // Guardar wamid + movimiento (fire-and-forget para no bloquear la respuesta)
              const waMovement = {
                id: crypto.randomUUID(),
                type: 'whatsapp_sent',
                description: `Notificación enviada por WhatsApp a +${formatPhoneForWhatsApp(recipientPhone) || recipientPhone}`,
                timestamp: new Date().toISOString(),
                userAgent: 'Server',
                clientIP: 'Server',
                forwardedIPs: [],
                realIP: 'Server',
                browser: 'Sistema (WhatsApp de Meta)',
                recipientEmail: emailData.recipientEmail || 'Unknown',
                whatsappMessageId: whatsappId,
              };
              docRef.update({
                'tracking.whatsappMessageId': whatsappId,
                'tracking.movements': FieldValue.arrayUnion(waMovement),
              }).catch(e => console.warn('⚠️ Error guardando whatsappMessageId:', e.message));
              // Índice para lookup rápido desde el webhook de delivery — DEBE ser await.
              // En Cloud Run las promesas fire-and-forget se matan al responder HTTP.
              try {
                await getFirestore().doc(`whatsapp_ids/${whatsappId}`).set({
                  mailDocId: docId,
                  recipientPhone: formatPhoneForWhatsApp(recipientPhone) || recipientPhone,
                  createdAt: FieldValue.serverTimestamp(),
                });
              } catch (e) {
                console.warn('⚠️ Error guardando whatsapp_ids:', e.message);
              }
            } else if (resultWA && resultWA.error) {
              const err = resultWA.error;
              whatsappError = err.error?.message || err.message || (typeof err === 'string' ? err : JSON.stringify(err));
            } else {
              whatsappError = 'La API de WhatsApp rechazó el envío';
            }
          }
        } catch (e) {
          whatsappError = e.message || 'Error en secrets o en API WhatsApp';
          console.warn('⚠️ WhatsApp error:', e.message);
        }
      } else {
        console.log('📱 Sin recipientPhone en documento, omitiendo WhatsApp');
      }

      if (emailData.campaignId && recipientPhone && whatsappError) {
        console.error('❌ WhatsApp de campaña falló:', whatsappError);
        return res.status(502).json({
          success: false,
          error: whatsappError,
          messageId: result.messageId || undefined,
        });
      }

      res.status(200).json({
        success: true,
        messageId: result.messageId,
        docId: docId,
        whatsappId: whatsappId || undefined,
        whatsappError: whatsappError || undefined
      });
      
    } catch (error) {
      console.error('Error:', error);
      
      // Solo actualizar el documento si docRef está definida
      if (typeof docRef !== 'undefined') {
        try {
          await docRef.update({
            delivery: {
              state: 'ERROR',
              time: FieldValue.serverTimestamp(),
              error: error.message
            }
          });
        } catch (updateError) {
          console.error('Error al actualizar documento:', updateError);
        }
      }
      
      // Devolver respuesta de error
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  }
);

/** GIF 1×1 transparente (respuesta de `trackOpen` para correos antiguos con pixel). */
const TRACK_OPEN_TRANSPARENT_GIF = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
);

/**
 * Endpoint histórico del pixel de apertura de correo.
 * Ya no registra `email_opened` ni toca Firestore: los correos nuevos no inyectan pixel;
 * las plantillas antiguas siguen recibiendo una imagen válida para no mostrar ícono roto.
 */
exports.trackOpen = onRequest({ region: REGION }, async (req, res) => {
  try {
    const { msg, k } = req.query;
    if (!msg || !k) {
      res.set('Content-Type', 'image/gif');
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      return res.status(200).send(TRACK_OPEN_TRANSPARENT_GIF);
    }

    const db = getFirestore();
    const snap = await db.collection('mail').doc(String(msg)).get();
    const data = snap.data() || {};
    const token = data?.tracking?.token;
    if (!snap.exists || !token || token !== String(k)) {
      res.set('Content-Type', 'image/gif');
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      return res.status(200).send(TRACK_OPEN_TRANSPARENT_GIF);
    }

    res.set('Content-Type', 'image/gif');
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    return res.status(200).send(TRACK_OPEN_TRANSPARENT_GIF);
  } catch (e) {
    console.error('trackOpen (deprecated, no-op):', e);
    res.set('Content-Type', 'image/gif');
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    return res.status(200).send(TRACK_OPEN_TRANSPARENT_GIF);
  }
});

const KNOWN_SCANNER_PATTERNS = [
  /barracuda/i,
  /proofpoint/i,
  /mimecast/i,
  /symantec/i,
  /trend\s*micro/i,
  /ironport/i,
  /messagelabs/i,
  /forcepoint/i,
  /linkscanner/i,
  /safebrowsing/i,
  // Nota: NO incluir GoogleImageProxy. En Gmail, cuando el destinatario activa imágenes,
  // el pixel se solicita con UA "GoogleImageProxy"; bloquearlo impedía registrar aperturas reales.
  /safelinks\.protection\.outlook/i,
  /office365/i,
  /msn\.com.*bot/i,
  /antivirus/i,
  /emailchecker/i,
  /validator/i,
  /spamhaus/i,
];

function isKnownScanner(userAgent) {
  if (!userAgent) return false;
  return KNOWN_SCANNER_PATTERNS.some((re) => re.test(userAgent));
}

/** Evita traer `tracking.movements` (puede crecer mucho y enlentecer / timeout en linkRedirect). */
const LINK_REDIRECT_READ_MASK = [
  'tracking.token',
  'tracking.opened',
  'tracking.openCount',
  'tracking.lastRedirectDedupe',
  'to',
  'recipientPhone',
  'recipientEmail',
  'attachments',
];

function linkRedirectDedupeTag(hasU, src, decodedUrl) {
  if (!hasU) return src === 'whatsapp' ? 'cta-wa' : 'cta-mail';
  return crypto.createHash('sha256').update(String(decodedUrl)).digest('hex').slice(0, 24);
}

function escapeHtmlTextEmail(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Escapa `&` para usar una URL absoluta dentro de un atributo HTML href. */
function escapeHrefAmpersands(url) {
  return String(url).replace(/&/g, '&amp;');
}

function urlsMatchAttachmentUrl(stored, clicked) {
  const a = String(stored || '').trim();
  const b = String(clicked || '').trim();
  if (!a || !b) return false;
  if (a === b) return true;
  try {
    return new URL(a).href === new URL(b).href;
  } catch {
    return false;
  }
}

function findAttachmentByDecodedUrl(attachments, decodedUrl) {
  if (!Array.isArray(attachments)) return null;
  for (const att of attachments) {
    if (!att || typeof att.fileUrl !== 'string') continue;
    if (urlsMatchAttachmentUrl(att.fileUrl, decodedUrl)) return att;
  }
  return null;
}

function isRecentDuplicateRedirect(dedupe, clientIP, tag, windowMs = 5000) {
  if (!dedupe || typeof dedupe.t !== 'number' || !dedupe.ip || !dedupe.tag) return false;
  return Date.now() - dedupe.t < windowMs && dedupe.ip === clientIP && dedupe.tag === tag;
}

/**
 * Registra `attachment_opened` + actualiza `attachments[].tracking` y redirige al archivo.
 * Usado por linkRedirect con `?att=id` (correo) o con `u=` cuando coincide fileUrl.
 */
async function handleAttachmentTrackingRedirect(req, res, opts) {
  const { docRef, data, k, matchedAttachment, readerUrl, redirectUrl, dedupeTag, src } = opts;
  const token = data?.tracking?.token;
  if (!token || token !== String(k)) {
    console.log('❌ Token inválido para tracking de adjunto');
    return res.redirect(302, readerUrl);
  }

  const userAgent = req.get('User-Agent') || 'Unknown';
  const clientIP =
    req.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
    req.get('X-Real-IP') ||
    req.connection.remoteAddress ||
    'Unknown';

  if (isRecentDuplicateRedirect(data?.tracking?.lastRedirectDedupe, clientIP, dedupeTag)) {
    console.log('⚠️ Duplicate attachment click (dedupe), skipping tracking');
    return res.redirect(302, redirectUrl);
  }

  const movementId = crypto.randomUUID();
  const forwardedIPs = req.get('X-Forwarded-For')
    ? req.get('X-Forwarded-For').split(',').map((ip) => ip.trim())
    : [];
  const realIP = req.get('X-Real-IP') || 'Unknown';
  const r = req.query.r;
  let recipientPhoneFromLink = null;
  let recipientPhoneVerified = false;
  if (r) {
    try {
      const decodedPhone = base64UrlDecode(String(r));
      const expected = data.recipientPhone ? formatPhoneForWhatsApp(data.recipientPhone) : null;
      recipientPhoneFromLink = decodedPhone;
      recipientPhoneVerified = Boolean(expected && decodedPhone === expected);
    } catch (decodePhoneErr) {
      console.warn('⚠️ No se pudo decodificar r (teléfono en enlace):', decodePhoneErr?.message);
    }
  }

  const mailboxRecipient =
    (data.recipientEmail && String(data.recipientEmail).trim().toLowerCase()) ||
    (Array.isArray(data.to) && data.to[0] ? String(data.to[0]).trim().toLowerCase() : '') ||
    '';
  const openedByDisplay = mailboxRecipient || data.recipientEmail || 'Unknown';
  const baseName = matchedAttachment.fileName || matchedAttachment.id || 'documento';
  const attachmentMovement = {
    id: movementId,
    type: 'attachment_opened',
    description: `Abrieron el adjunto «${baseName}» desde el enlace del correo (descarga / vista del archivo).`,
    source: src || 'email',
    timestamp: new Date().toISOString(),
    userAgent,
    clientIP,
    forwardedIPs,
    realIP,
    browser: extractBrowserInfo(userAgent),
    recipientEmail: data.recipientEmail || 'Unknown',
    ...(data.recipientEmail ? { mailRecipientEmail: data.recipientEmail } : {}),
    openedByEmail: openedByDisplay,
    viewerIsSender: false,
    openerHasFirebaseSession: false,
    attachmentId: matchedAttachment.id,
    fileName: matchedAttachment.fileName || null,
    action: 'opened',
    ...(recipientPhoneFromLink ? { recipientPhone: recipientPhoneFromLink, recipientPhoneVerified } : {}),
  };

  const attachmentsArr = Array.isArray(data.attachments)
    ? data.attachments.map((a) => (a && typeof a === 'object' ? { ...a } : a))
    : [];
  const idx = attachmentsArr.findIndex((att) => att && String(att.id) === String(matchedAttachment.id));

  const attachmentUpdate = {
    'tracking.lastAttachmentActivity': FieldValue.serverTimestamp(),
    'tracking.movements': FieldValue.arrayUnion(attachmentMovement),
    'tracking.attachmentsOpened': FieldValue.increment(1),
    'tracking.lastRedirectDedupe': { t: Date.now(), ip: clientIP, tag: dedupeTag },
  };

  if (idx >= 0) {
    const prev = attachmentsArr[idx].tracking || {};
    const prevClick = typeof prev.clickCount === 'number' ? prev.clickCount : 0;
    const prevDev = prev.deviceInfo || {};
    attachmentsArr[idx] = {
      ...attachmentsArr[idx],
      tracking: {
        opened: true,
        openedAt: new Date().toISOString(),
        duration: typeof prev.duration === 'number' ? prev.duration : 0,
        scrollDepth: typeof prev.scrollDepth === 'number' ? prev.scrollDepth : 0,
        deviceInfo: {
          userAgent:
            typeof prevDev.userAgent === 'string' && prevDev.userAgent ? prevDev.userAgent : userAgent,
          screenResolution:
            typeof prevDev.screenResolution === 'string' ? prevDev.screenResolution : '—',
          timezone: typeof prevDev.timezone === 'string' ? prevDev.timezone : '—',
        },
        ipAddress: clientIP,
        signatureStatus: prev.signatureStatus || 'pending',
        ...(prev.signatureTimestamp ? { signatureTimestamp: prev.signatureTimestamp } : {}),
        clickCount: prevClick + 1,
      },
    };
    attachmentUpdate.attachments = attachmentsArr;
  }

  try {
    await docRef.update(attachmentUpdate);
    console.log('✅ Adjunto desde correo — attachment_opened registrado');
    certifyPolygonEventOnce(docRef.id, data, 'content_access', 'attachment_opened', 'attachment');
  } catch (updateErr) {
    // La apertura del archivo no debe romperse por un fallo de tracking.
    console.error('⚠️ No se pudo registrar attachment_opened; redirigiendo igual:', updateErr?.message);
  }
  return res.redirect(302, redirectUrl);
}

const linkRedirectOptions = { region: REGION, secrets: [polygonCertifySecret], timeoutSeconds: 180, memory: '512MiB' };

/** Propaga el click del enlace a campaign_messages (dashboard de campañas). */
async function syncCampaignMessageClick(mailDocId, isWhatsApp) {
  try {
    const db = getFirestore();
    const snap = await db.collection('campaign_messages').where('mailId', '==', String(mailDocId)).limit(1).get();
    if (snap.empty) return;
    const ref = snap.docs[0].ref;
    const prev = snap.docs[0].data() || {};
    const update = {};
    if (isWhatsApp) {
      if (!prev.waClickAt) update.waClickAt = FieldValue.serverTimestamp();
      update.waClickCount = FieldValue.increment(1);
    } else {
      if (!prev.emailClickAt) update.emailClickAt = FieldValue.serverTimestamp();
      update.emailClickCount = FieldValue.increment(1);
    }
    if (Object.keys(update).length) {
      await ref.update(update);
      console.log(`✅ campaign_message click (${isWhatsApp ? 'WA' : 'email'}) mail/${mailDocId}`);
    }
  } catch (e) {
    console.warn('⚠️ syncCampaignMessageClick:', e?.message);
  }
}

async function linkRedirectHandler(req, res) {
  try {
    const { msg, u, k, src, r, att } = req.query;
    console.log('🔗 linkRedirect called with:', {
      msg,
      u: u ? '(set)' : '(none)',
      k: k ? '(set)' : '(none)',
      att: att ? String(att).slice(0, 40) : '(none)',
      src,
      r: r ? '(set)' : '',
    });

    if (!msg || !k) return res.status(400).send('Missing params');

    const userAgentForCheck = req.get('User-Agent') || '';
    if (isKnownScanner(userAgentForCheck)) {
      console.log('🤖 Scanner de email detectado, redirigiendo sin tracking:', userAgentForCheck.substring(0, 80));
      const readerFallback = `${APP_HOSTING_URL}/reader/${encodeURIComponent(String(msg))}?k=${encodeURIComponent(String(k))}`;
      return res.redirect(302, readerFallback);
    }

    const readerUrl = `${APP_HOSTING_URL}/reader/${encodeURIComponent(String(msg))}?k=${encodeURIComponent(String(k))}`;

    const attIdRaw = att != null && String(att).trim() !== '' ? String(att).trim() : '';
    if (attIdRaw) {
      console.log('📎 linkRedirect: adjunto del correo (att)');
      const db = getFirestore();
      const docRef = db.collection('mail').doc(String(msg));
      const snap = await docRef.get({ fieldMask: LINK_REDIRECT_READ_MASK });
      if (!snap.exists) {
        return res.redirect(302, readerUrl);
      }
      const dataAtt = snap.data() || {};
      const listAtt = Array.isArray(dataAtt.attachments) ? dataAtt.attachments : [];
      const matchedAtt = listAtt.find(
        (a) => a && (String(a.id) === attIdRaw || String(a.fileName) === attIdRaw),
      );
      if (!matchedAtt || typeof matchedAtt.fileUrl !== 'string' || !/^https?:\/\//i.test(matchedAtt.fileUrl.trim())) {
        console.log('⚠️ Parámetro att sin adjunto válido:', attIdRaw);
        return res.redirect(302, readerUrl);
      }
      return handleAttachmentTrackingRedirect(req, res, {
        docRef,
        data: dataAtt,
        k,
        matchedAttachment: matchedAtt,
        readerUrl,
        redirectUrl: matchedAtt.fileUrl.trim(),
        dedupeTag: `att-open-${attIdRaw}`,
        src,
      });
    }

    // Sin `u`: mismo enlace que el botón del correo (msg + k) — correo o WhatsApp con `src=whatsapp`
    if (!u) {
      console.log('🔗 Sin parámetro u — CTA correo o enlace corto WhatsApp, redirigiendo al reader');
      const db = getFirestore();
      const docRef = db.collection('mail').doc(String(msg));
      const snap = await docRef.get({ fieldMask: LINK_REDIRECT_READ_MASK });
      if (snap.exists) {
        const data = snap.data() || {};
        const token = data?.tracking?.token;
        if (token && token === String(k)) {
          const clientIP = req.get('X-Forwarded-For')?.split(',')[0]?.trim() || req.get('X-Real-IP') || req.connection.remoteAddress || 'Unknown';
          const dedupeTag = linkRedirectDedupeTag(false, String(src || ''), '');
          if (isRecentDuplicateRedirect(data?.tracking?.lastRedirectDedupe, clientIP, dedupeTag)) {
            console.log('⚠️ Duplicate CTA / WhatsApp click (dedupe), skipping update');
          } else {
            const isWhatsApp = src === 'whatsapp';
            let recipientPhoneFromLink = null;
            let recipientPhoneVerified = false;
            if (r) {
              try {
                const decodedPhone = base64UrlDecode(String(r));
                const expected = data.recipientPhone ? formatPhoneForWhatsApp(data.recipientPhone) : null;
                recipientPhoneFromLink = decodedPhone;
                recipientPhoneVerified = Boolean(expected && decodedPhone === expected);
              } catch (decodePhoneErr) {
                console.warn('⚠️ No se pudo decodificar r (teléfono en enlace):', decodePhoneErr?.message);
              }
            }
            const movement = {
              id: crypto.randomUUID(),
              type: isWhatsApp ? 'whatsapp_link_clicked' : 'link_clicked',
              description: isWhatsApp
                ? recipientPhoneVerified && recipientPhoneFromLink
                  ? `Pulsaron el enlace en WhatsApp (número del envío: +${recipientPhoneFromLink})`
                  : 'Pulsaron el enlace en WhatsApp para abrir la notificación'
                : 'Pulsaron el botón del correo para abrir la notificación',
              source: src || 'email',
              timestamp: new Date().toISOString(),
              userAgent: userAgentForCheck,
              clientIP,
              forwardedIPs: req.get('X-Forwarded-For') ? req.get('X-Forwarded-For').split(',').map(ip => ip.trim()) : [],
              realIP: req.get('X-Real-IP') || 'Unknown',
              browser: extractBrowserInfo(userAgentForCheck),
              recipientEmail: data.recipientEmail || 'Unknown',
              ...(recipientPhoneFromLink ? { recipientPhone: recipientPhoneFromLink, recipientPhoneVerified } : {}),
            };
            const updateData = {
              'tracking.clickCount': FieldValue.increment(1),
              'tracking.lastClickAt': FieldValue.serverTimestamp(),
              'tracking.movements': FieldValue.arrayUnion(movement),
              'tracking.lastRedirectDedupe': { t: Date.now(), ip: clientIP, tag: dedupeTag },
            };
            if (isWhatsApp && !data?.tracking?.opened) {
              updateData['tracking.opened'] = true;
              updateData['tracking.openedAt'] = FieldValue.serverTimestamp();
              updateData['tracking.openCount'] = FieldValue.increment(1);
            }
            await docRef.update(updateData);
            certifyPolygonEventOnce(msg, data, 'content_access', isWhatsApp ? 'whatsapp_cta' : 'email_cta', isWhatsApp ? 'whatsapp' : 'email');
            await syncCampaignMessageClick(msg, isWhatsApp);
            console.log(isWhatsApp ? '✅ whatsapp_link_clicked (enlace corto) registrado' : '✅ link_clicked (CTA) registrado');
          }
        } else {
          console.log('❌ Token inválido para CTA click');
        }
      }
      return res.redirect(302, readerUrl);
    }

    // VALIDACIÓN TEMPRANA: Verificar que el parámetro codificado tenga una longitud razonable
    // "#" codificado en base64 es "Iw==" (4 caracteres), muy corto para ser una URL real
    const encodedUrl = String(u);
    if (!encodedUrl || encodedUrl.length < 10) {
      console.log(`⚠️ URL codificada demasiado corta (${encodedUrl.length} chars), probablemente inválida. Redirigiendo sin tracking.`);
      return res.redirect(302, readerUrl);
    }

    let decodedUrl;
    let url;
    let isOriginalUrlValid = false;

    try {
      decodedUrl = base64UrlDecode(encodedUrl);
      // Limpiar la URL (trim) y validar
      decodedUrl = decodedUrl ? decodedUrl.trim() : '';
      console.log('🔗 Decoded URL:', decodedUrl);

      // VALIDACIÓN EXPLÍCITA: Rechazar fragmentos de hash y URLs vacías ANTES de cualquier procesamiento
      if (!decodedUrl ||
          decodedUrl === '#' ||
          decodedUrl === '' ||
          decodedUrl.startsWith('#')) {
        console.log('⚠️ URL decodificada es un fragmento (#) o inválida, redirigiendo SIN tracking');
        url = readerUrl;
        isOriginalUrlValid = false;
      } else if (decodedUrl.match(/^https?:\/\//i)) {
        // URL HTTP/HTTPS válida
        url = decodedUrl;
        isOriginalUrlValid = true;
      } else {
        // URL relativa u otro tipo inválido
        console.log('⚠️ URL decodificada no es HTTP/HTTPS válida, redirigiendo SIN tracking');
        url = readerUrl;
        isOriginalUrlValid = false;
      }
    } catch (decodeError) {
      console.error('❌ Error decoding URL:', decodeError);
      url = readerUrl;
      isOriginalUrlValid = false;
    }
    
    const db = getFirestore();
    const docRef = db.collection('mail').doc(String(msg));

    if (!isOriginalUrlValid) {
      console.log('⚠️ Invalid URL detected (was: "' + String(decodedUrl ?? '') + '"), skipping tracking completely');
      return res.redirect(302, url);
    }

    const snap = await docRef.get({ fieldMask: LINK_REDIRECT_READ_MASK });

    if (!snap.exists) {
      console.log('❌ Document not found:', msg);
      return res.redirect(302, url);
    }

    const data = snap.data() || {};
    const token = data?.tracking?.token;
    console.log('🔑 Token comparison:', {
      storedToken: token,
      providedToken: String(k),
      match: token === String(k),
    });

    // Solo registrar tracking si el token es válido Y la URL original era válida
    if (token && token === String(k)) {
      console.log('✅ Token valid and URL valid, checking for duplicates');

      const userAgent = req.get('User-Agent') || 'Unknown';
      const clientIP =
        req.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
        req.get('X-Real-IP') ||
        req.connection.remoteAddress ||
        'Unknown';
      const dedupeTag = linkRedirectDedupeTag(true, String(src || ''), decodedUrl);

      if (isRecentDuplicateRedirect(data?.tracking?.lastRedirectDedupe, clientIP, dedupeTag)) {
        console.log('⚠️ Duplicate click (dedupe), skipping tracking');
        return res.redirect(302, url);
      }

      console.log('✅ No duplicate found, updating tracking');

      const forwardedIPs = req.get('X-Forwarded-For') ? req.get('X-Forwarded-For').split(',').map((ip) => ip.trim()) : [];
      const realIP = req.get('X-Real-IP') || 'Unknown';
      
      // Generar UUID único para este movimiento
      const movementId = crypto.randomUUID();
      
      let recipientPhoneFromLink = null;
      let recipientPhoneVerified = false;
      if (r) {
        try {
          const decodedPhone = base64UrlDecode(String(r));
          const expected = data.recipientPhone ? formatPhoneForWhatsApp(data.recipientPhone) : null;
          recipientPhoneFromLink = decodedPhone;
          recipientPhoneVerified = Boolean(expected && decodedPhone === expected);
        } catch (decodePhoneErr) {
          console.warn('⚠️ No se pudo decodificar r (teléfono en enlace):', decodePhoneErr?.message);
        }
      }

      const matchedAttachment = findAttachmentByDecodedUrl(data.attachments, decodedUrl);
      if (matchedAttachment) {
        return handleAttachmentTrackingRedirect(req, res, {
          docRef,
          data,
          k,
          matchedAttachment,
          readerUrl,
          redirectUrl: url,
          dedupeTag,
          src,
        });
      }

      const isWhatsApp = src === 'whatsapp';
      const movement = {
        id: movementId,
        type: isWhatsApp ? 'whatsapp_link_clicked' : 'link_clicked',
        description: isWhatsApp
          ? recipientPhoneVerified && recipientPhoneFromLink
            ? `Pulsaron el enlace en WhatsApp (número del envío: +${recipientPhoneFromLink})`
            : 'Pulsaron el enlace en WhatsApp para abrir la notificación'
          : `Pulsaron un enlace dentro del correo: ${decodedUrl}`,
        source: src || 'email',
        timestamp: new Date().toISOString(),
        userAgent: userAgent,
        clientIP: clientIP,
        forwardedIPs: forwardedIPs,
        realIP: realIP,
        browser: extractBrowserInfo(userAgent),
        recipientEmail: data.recipientEmail || 'Unknown',
        ...(recipientPhoneFromLink ? { recipientPhone: recipientPhoneFromLink, recipientPhoneVerified: recipientPhoneVerified } : {})
      };
      const updateData = {
        'tracking.clickCount': FieldValue.increment(1),
        'tracking.lastClickAt': FieldValue.serverTimestamp(),
        'tracking.movements': FieldValue.arrayUnion(movement),
        'tracking.lastRedirectDedupe': { t: Date.now(), ip: clientIP, tag: dedupeTag },
      };
      if (isWhatsApp && !data?.tracking?.opened) {
        updateData['tracking.opened'] = true;
        updateData['tracking.openedAt'] = FieldValue.serverTimestamp();
        updateData['tracking.openCount'] = FieldValue.increment(1);
      }
      await docRef.update(updateData);
      certifyPolygonEventOnce(msg, data, 'content_access', isWhatsApp ? 'whatsapp_link' : 'email_link', isWhatsApp ? 'whatsapp' : 'email');
      await syncCampaignMessageClick(msg, isWhatsApp);

      console.log('✅ Tracking updated successfully');
    } else {
      console.log('❌ Token invalid or missing');
    }

    return res.redirect(302, url);
  } catch (e) {
    console.error('❌ Error in linkRedirect:', e);
    // En caso de error, intentar redirigir al reader si tenemos el msg
    const { msg, k } = req.query;
    if (msg && k) {
      const fallbackUrl = `${APP_HOSTING_URL}/reader/${encodeURIComponent(String(msg))}?k=${encodeURIComponent(String(k))}`;
      return res.status(302).redirect(fallbackUrl);
    }
    return res.status(302).redirect(APP_HOSTING_URL);
  }
}

exports.linkRedirect = onRequest(linkRedirectOptions, linkRedirectHandler);

exports.confirmRead = onRequest({ region: REGION, secrets: [polygonCertifySecret] }, async (req, res) => {
  try {
    console.log('🔍 confirmRead called with params:', req.query);
    const { msg, k } = req.query;
    if (!msg || !k) {
      console.log('❌ Missing params:', { msg, k });
      return res.status(400).send('Missing params');
    }

    const db = getFirestore();
    const docRef = db.collection('mail').doc(String(msg));
    const snap = await docRef.get();
    if (!snap.exists) return res.status(404).send('Not found');

    const data = snap.data() || {};
    const token = data?.tracking?.token;
    if (!token || token !== String(k)) {
      return res.status(403).send('Forbidden');
    }

    // Obtener información detallada del usuario
    const userAgent = req.get('User-Agent') || 'Unknown';
    const clientIP = req.get('X-Forwarded-For') || req.get('X-Real-IP') || req.connection.remoteAddress || 'Unknown';
    const forwardedIPs = req.get('X-Forwarded-For') ? req.get('X-Forwarded-For').split(',').map(ip => ip.trim()) : [];
    const realIP = req.get('X-Real-IP') || 'Unknown';
    
    // Generar UUID único para este movimiento
    const movementId = crypto.randomUUID();
    
    // Crear movimiento detallado
    const movement = {
      id: movementId,
      type: 'read_confirmed',
      description: 'Confirmaron la lectura del mensaje (constancia para el expediente).',
      timestamp: new Date().toISOString(),
      userAgent: userAgent,
      clientIP: clientIP,
      forwardedIPs: forwardedIPs,
      realIP: realIP,
      browser: extractBrowserInfo(userAgent),
      recipientEmail: data.recipientEmail || 'Unknown'
    };

    await docRef.update({
      'tracking.readConfirmed': true,
      'tracking.readConfirmedAt': FieldValue.serverTimestamp(),
      'tracking.movements': FieldValue.arrayUnion(movement)
    });

    // Certificar lectura en Polygon
    try {
      const certifyUrl = `${APP_HOSTING_URL}/api/polygon/certify-event`;
      const certifyRes = await fetch(certifyUrl, certifyEventFetchInit({
        docId: String(msg),
        type: 'read_confirmed',
        userId: data?.recipientEmail,
      }));
      if (!certifyRes.ok) console.warn('⚠️ Polygon certify read:', await certifyRes.text());
    } catch (e) {
      console.warn('⚠️ Polygon certify read failed:', e?.message);
    }

    res.set('Content-Type', 'text/html; charset=utf-8');
    return res
      .status(200)
      .send('<!doctype html><html><body><h3>Lectura confirmada ✅</h3><p>Gracias.</p></body></html>');
  } catch (e) {
    console.error(e);
    return res.status(200).send('OK');
  }
});

// Función para parsear asuntos de correos entrantes con formato CERTIFICAR
function parseCertifySubject(subject) {
  if (!subject) return null;
  
  // Patrones flexibles para detectar el formato CERTIFICAR
  const patterns = [
    // "CERTIFICAR - email@domain.com - asunto"
    /certificar\s*[-–—]?\s*([^\s@]+@[^\s@]+\.[^\s@]+)\s*[-–—]?\s*(.*)/i,
    // "CERTIFICAR email@domain.com asunto"
    /certificar\s+([^\s@]+@[^\s@]+\.[^\s@]+)\s+(.*)/i,
    // "CERTIFICAR-email@domain.com-asunto" (sin espacios)
    /certificar[-–—]([^\s@]+@[^\s@]+\.[^\s@]+)[-–—](.*)/i
  ];
  
  for (const pattern of patterns) {
    const match = subject.match(pattern);
    if (match) {
      return {
        recipient: match[1].trim(),
        actualSubject: match[2].trim() || 'Sin asunto'
      };
    }
  }
  
  return null;
}

function inboundAuthorized(req) {
  const expected = (polygonCertifySecret.value() || '').trim();
  if (!expected) {
    console.warn('⚠️ POLYGON_CERTIFY_SECRET vacío — processIncomingEmail sin auth (solo entorno local)');
    return true;
  }
  const header = String(req.get('X-Certify-Secret') || req.get('x-certify-secret') || '').trim();
  const token = String(req.query.token || req.query.secret || '').trim();
  return header === expected || token === expected;
}

// Función para procesar correos entrantes desde clientes de email externos
exports.processIncomingEmail = onRequest({ region: REGION, secrets: [smtpPass, polygonCertifySecret] }, async (req, res) => {
  try {
    if (!inboundAuthorized(req)) {
      return res.status(401).json({ error: 'No autorizado' });
    }
    console.log('📧 Procesando correo entrante:', req.body);

    const incoming = req.body && typeof req.body === 'object' ? req.body : {};
    if (looksLikeBouncePayload(incoming)) {
      const applied = await applyEmailBounceFromPayload(getFirestore(), incoming);
      return res.status(200).json({
        success: true,
        bounce: true,
        matched: Boolean(applied),
        mailId: applied?.mailId || null,
      });
    }
    
    const { from, to, subject, text, html, attachments } = req.body;
    
    if (!from || !subject) {
      return res.status(400).json({ error: 'from y subject son requeridos' });
    }
    
    // Verificar si el remitente es un usuario registrado
    const db = getFirestore();
    const usersQuery = await db.collection('users').where('email', '==', from).get();
    
    if (usersQuery.empty) {
      console.log('❌ Remitente no es usuario registrado:', from);
      return res.status(200).json({ 
        success: false, 
        message: 'Remitente no es usuario registrado' 
      });
    }
    
    const user = usersQuery.docs[0].data();
    console.log('✅ Usuario registrado encontrado:', user.email);
    
    // Parsear el asunto para extraer destinatario y asunto real
    const parsed = parseCertifySubject(subject);
    
    if (!parsed) {
      console.log('❌ Formato de asunto no válido:', subject);
      return res.status(200).json({ 
        success: false, 
        message: 'Formato de asunto no válido. Use: CERTIFICAR - destinatario@email.com - Asunto' 
      });
    }

    /** Alineado con la app (`scheduleEmail`): destinatarios en minúsculas para `array-contains` en bandeja. */
    const recipientNorm = parsed.recipient.trim().toLowerCase();
    
    console.log('✅ Asunto parseado:', parsed, '→ recipientNorm:', recipientNorm);
    
    // Verificar si ya existe un correo similar para evitar duplicados
    const existingQuery = await db.collection('mail')
      .where('senderName', '==', user.email)
      .where('message.subject', '==', parsed.actualSubject)
      .where('recipientEmail', '==', recipientNorm)
      .limit(1)
      .get();
    
    if (!existingQuery.empty) {
      console.log('⚠️ Correo similar ya existe, evitando duplicado');
      const existingDoc = existingQuery.docs[0];
      return res.status(200).json({ 
        success: true, 
        messageId: existingDoc.data().delivery?.info,
        docId: existingDoc.id,
        recipient: recipientNorm,
        subject: parsed.actualSubject,
        duplicate: true
      });
    }
    
    // Crear el correo certificado
    const trackingToken = generateToken();
    const docRef = db.collection('mail').doc();
    const docId = docRef.id;
    
    // Crear HTML del mensaje
    const htmlContent = html || text.replace(/\n/g, '<br>');
    
    // Build reader URL
    const readerUrl = `${APP_HOSTING_URL}/reader/${encodeURIComponent(docId)}?k=${encodeURIComponent(trackingToken)}`;
    
    // Build email with template
    const htmlWithTracking = generateEmailWithTracking({
      senderName: user.email,
      recipientName: recipientNorm.split('@')[0],
      recipientEmail: recipientNorm,
      readUrl: readerUrl,
      fallbackUrl: readerUrl,
      year: new Date().getFullYear(),
      docId: docId,
      trackingToken: trackingToken,
      linkRedirectUrl: LINK_REDIRECT_URL
    });
    
    // Generar versión de texto plano completa con toda la información
    const recipientName = recipientNorm.split('@')[0];
    const textVersion = `NOTIFICACION
Nueva comunicacion para usted
Enviada por ${user.email} mediante Notificas.com

Estimado/a ${recipientName},

Ha recibido una comunicacion fehaciente digital remitida por ${user.email}. Le recomendamos acceder a su contenido, ya que puede ser relevante para:

- Responder en tiempo y forma.
- Ejercer sus derechos y dejar constancia tecnica de acceso.
- Conservar evidencia de recepcion y lectura.

Leer Notificacion: ${readerUrl}

Si el boton no funciona, copie y pegue este enlace en su navegador:
${readerUrl}

La notificacion, sus metadatos de envio, recepcion y lectura quedan certificados y registrados en la red Blockchain a traves de Notificas.com. Esta constancia tecnica no implica conformidad con el contenido.

Para dejar constancia de que ha accedido al mensaje, puede utilizar el siguiente enlace:
Confirmar lectura: ${readerUrl}

${new Date().getFullYear()} Notificas.com
Este mensaje fue destinado a ${recipientNorm}. Si no reconoce esta notificacion, ignore este correo o responda a contacto@notificas.com.`;
    
    // Persistir antes del SMTP para que el enlace del reader nunca apunte a un doc inexistente
    // si Firestore falla, el usuario no recibe correo con URL rota.
    await docRef.set({
      to: [recipientNorm],
      from: 'contacto@notificas.com',
      senderName: user.email,
      recipientName: recipientNorm.split('@')[0],
      recipientEmail: recipientNorm,
      message: {
        subject: parsed.actualSubject,
        html: htmlContent,
        text: text || htmlContent.replace(/<[^>]*>/g, '')
      },
      delivery: {
        state: 'SENDING',
        time: FieldValue.serverTimestamp(),
        info: null
      },
      tracking: {
        token: trackingToken,
        sentAt: null,
        openCount: 0,
        clickCount: 0,
        opened: false,
        openedAt: null,
        readConfirmed: false,
        readConfirmedAt: null,
        messageId: null
      },
      readerUrl,
      createdAt: FieldValue.serverTimestamp(),
      timestamp: new Date().toISOString(),
      source: 'external_email', // Marcar como correo enviado desde email externo
      sourceLabel: 'Enviado desde Gmail',
      sourceIcon: '📧'
    });

    // Enviar el correo certificado
    const mailOptions = {
      from: formatSmtpFrom(DEFAULT_FROM_EMAIL),
      to: recipientNorm,
      subject: parsed.actualSubject,
      text: textVersion,
      html: htmlWithTracking,
      replyTo: user.email,
      headers: { 'X-Notificas-Mail-Id': docId },
    };
    
    console.log('📧 Enviando correo certificado a:', recipientNorm);
    const result = await getTransporter().sendMail(mailOptions);

    if (!result.messageId) {
      throw new Error('No se recibió messageId del servidor de correo');
    }

    await docRef.update({
      'delivery.state': 'DELIVERED',
      'delivery.time': FieldValue.serverTimestamp(),
      'delivery.info': result.messageId,
      'tracking.sentAt': FieldValue.serverTimestamp(),
      'tracking.messageId': result.messageId
    });
    
    console.log('✅ Correo certificado enviado:', result.messageId);
    
    res.status(200).json({ 
      success: true, 
      messageId: result.messageId,
      docId: docId,
      recipient: recipientNorm,
      subject: parsed.actualSubject
    });
    
  } catch (error) {
    console.error('❌ Error procesando correo entrante:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ---------------------------------------------------------------------------
// WhatsApp Webhook — recibe status de entrega/lectura de Meta
// Configurar en Meta Developer Portal → Webhooks → messages
// URL: https://whatsappwebhook-ju7n3yysfq-uc.a.run.app  (o la URL que asigne Cloud Run)
// ---------------------------------------------------------------------------

async function resolveMailDocIdFromWhatsAppMessageId(db, wamid) {
  const id = typeof wamid === 'string' ? wamid.trim() : '';
  if (!id) return null;
  const candidates = [id, id.startsWith('wamid.') ? id : `wamid.${id}`];
  const tried = new Set();
  for (const key of candidates) {
    if (!key || tried.has(key)) continue;
    tried.add(key);
    const snap = await db.doc(`whatsapp_ids/${key}`).get();
    if (snap.exists) {
      const d = snap.data();
      if (d?.mailDocId) return d.mailDocId;
    }
  }
  return null;
}

async function processWhatsAppStatus(status) {
  const wamid = status.id;
  const statusType = status.status; // sent | delivered | read | failed
  const recipientPhone = status.recipient_id;
  const timestamp = status.timestamp
    ? new Date(parseInt(status.timestamp, 10) * 1000).toISOString()
    : new Date().toISOString();

  console.log(`📱 WhatsApp status: ${statusType} | wamid=${wamid} | phone=${recipientPhone}`);

  // Solo procesar delivered, read y failed (sent ya se registra al enviar)
  if (!['delivered', 'read', 'failed'].includes(statusType)) return;

  const db = getFirestore();
  const mailDocId = await resolveMailDocIdFromWhatsAppMessageId(db, wamid);
  if (!mailDocId) {
    console.warn(`⚠️ No se encontró mailDocId para wamid=${wamid} (whatsapp_ids)`);
    return;
  }
  const mailRef = db.doc(`mail/${mailDocId}`);
  const typeMap = { delivered: 'whatsapp_delivered', read: 'whatsapp_read', failed: 'whatsapp_failed' };
  const recorded = await db.runTransaction(async (t) => {
    const mailSnap = await t.get(mailRef);
    if (!mailSnap.exists) return { wrote: false, reason: 'missing', data: null };
    const data = mailSnap.data() || {};
    const alreadyByFlag =
      (statusType === 'delivered' && data.tracking?.whatsappDelivered) ||
      (statusType === 'read' && data.tracking?.whatsappRead);
    const alreadyByMovement = (data.tracking?.movements || []).some(
      (m) => m.type === `whatsapp_${statusType}`
    );
    if (alreadyByFlag || alreadyByMovement) {
      return { wrote: false, reason: 'dup', data };
    }

    const descMap = {
      delivered: `Mensaje de WhatsApp entregado al teléfono +${recipientPhone}`,
      read: `Mensaje de WhatsApp leído en el teléfono +${recipientPhone}`,
      failed: `Error de entrega en WhatsApp para +${recipientPhone}${status.errors?.[0]?.title ? ': ' + status.errors[0].title : ''}`,
    };

    const movement = {
      id: crypto.randomUUID(),
      type: typeMap[statusType],
      description: descMap[statusType],
      timestamp,
      userAgent: 'Sistema (WhatsApp de Meta)',
      clientIP: 'Server',
      forwardedIPs: [],
      realIP: 'Server',
      browser: 'WhatsApp',
      recipientEmail: data.recipientEmail || 'Unknown',
      recipientPhone,
      whatsappMessageId: wamid,
    };

    const update = { 'tracking.movements': FieldValue.arrayUnion(movement) };
    if (statusType === 'delivered') {
      update['tracking.whatsappDelivered'] = true;
      update['tracking.whatsappDeliveredAt'] = FieldValue.serverTimestamp();
    } else if (statusType === 'read') {
      update['tracking.whatsappRead'] = true;
      update['tracking.whatsappReadAt'] = FieldValue.serverTimestamp();
    }

    t.update(mailRef, update);
    return { wrote: true, reason: 'ok', data };
  });

  if (recorded.wrote) {
    try {
      await db.collection('provider_events').add({
        mailId: mailDocId,
        campaignId: recorded.data?.campaignId || null,
        provider: 'meta',
        eventType: statusType,
        providerMessageId: wamid,
        recipient: recipientPhone,
        providerTimestamp: timestamp,
        raw: status,
        receivedAt: FieldValue.serverTimestamp(),
      });
    } catch (e) {
      console.warn('⚠️ No se pudo guardar provider_event WA (CF):', e.message);
    }
  }

  if (!recorded.wrote) {
    if (recorded.reason === 'missing') {
      console.warn(`⚠️ Documento mail/${mailDocId} no encontrado`);
    } else {
      console.log(`⚠️ whatsapp_${statusType} ya registrado para mail/${mailDocId}, skip`);
    }
    return;
  }

  const data = recorded.data || {};
  const isCampaignMail = Boolean(data.campaignId);
  if (!isCampaignMail) {
    if (statusType === 'delivered') {
      certifyPolygonEventOnce(mailDocId, data, 'wa_delivered', 'whatsapp_delivered');
    } else if (statusType === 'read') {
      certifyPolygonEventOnce(mailDocId, data, 'wa_read', 'whatsapp_read');
    }
  } else if (statusType === 'delivered' || statusType === 'read') {
    void fetch(`${APP_HOSTING_URL}/api/campaigns/integrity/event`, certifyEventFetchInit({
      mailId: mailDocId,
      eventType: statusType === 'delivered' ? 'wa_delivered' : 'wa_read',
      occurredAt: timestamp,
    })).catch((e) => console.warn('⚠️ Integrity event WA:', e?.message));
  }
  console.log(`✅ whatsapp_${statusType} registrado en mail/${mailDocId}`);

  // Actualizar campaign_message con el estado WA
  try {
    const cmSnap = await db.collection('campaign_messages').where('mailId', '==', mailDocId).limit(1).get();
    if (!cmSnap.empty) {
      const cmRef = cmSnap.docs[0].ref;
      const cmUpdate = {};
      const poly = data.polygonCertifications || {};
      if (statusType === 'delivered') {
        cmUpdate.waEstado = 'entregado';
        cmUpdate.waEntregadoAt = FieldValue.serverTimestamp();
        cmUpdate.estado = 'enviado';
        if (poly.send)    cmUpdate.waTxEnvio     = poly.send;
        if (poly.receive) cmUpdate.waTxEntregado = poly.receive;
      } else if (statusType === 'read') {
        cmUpdate.waEstado = 'leido';
        cmUpdate.waLeidoAt = FieldValue.serverTimestamp();
        cmUpdate.estado = 'leido';
        cmUpdate.leidoAt = FieldValue.serverTimestamp();
        if (poly.send)    cmUpdate.waTxEnvio     = poly.send;
        if (poly.receive) cmUpdate.waTxEntregado = poly.receive;
        if (poly.read)    cmUpdate.waTxLeido     = poly.read;
      } else if (statusType === 'failed') {
        cmUpdate.waEstado = 'error';
        cmUpdate.waError = status.errors?.[0]?.title || 'Error de entrega WA';
        cmUpdate.estado = 'error';
      }
      const cmPrev = cmSnap.docs[0].data();
      await cmRef.update(cmUpdate);
      console.log(`✅ campaign_message actualizado: ${cmSnap.docs[0].id} → waEstado=${cmUpdate.waEstado}`);

      // Actualizar contadores campaign.stats
      const campaignId = cmPrev.campaignId;
      if (campaignId) {
        const statsUpdate = {};
        const prevEstado = cmPrev.estado;
        if (statusType === 'read' && prevEstado !== 'leido') {
          statsUpdate['stats.leidos'] = FieldValue.increment(1);
          if (prevEstado === 'pendiente') statsUpdate['stats.pendientes'] = FieldValue.increment(-1);
        } else if (statusType === 'failed' && prevEstado !== 'error') {
          statsUpdate['stats.errores'] = FieldValue.increment(1);
          if (prevEstado === 'pendiente') statsUpdate['stats.pendientes'] = FieldValue.increment(-1);
        }
        if (Object.keys(statsUpdate).length > 0) {
          db.collection('campaigns').doc(campaignId).update(statsUpdate)
            .catch(e => console.warn('⚠️ Error actualizando stats campaña desde webhook WA:', e.message));
        }
      }
    }
  } catch (e) {
    console.warn('⚠️ Error actualizando campaign_message desde webhook WA:', e.message);
  }
}

function verifyWhatsAppHubSignature(rawBody, signatureHeader, appSecret) {
  const secret = (appSecret || '').trim();
  const header = String(signatureHeader || '').trim();
  if (!secret || !header.startsWith('sha256=')) return false;
  const received = header.slice('sha256='.length);
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  try {
    const a = Buffer.from(expected, 'hex');
    const b = Buffer.from(received, 'hex');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

exports.whatsappWebhook = onRequest(
  { region: REGION, secrets: [whatsappVerifyToken, polygonCertifySecret, whatsappAppSecret] },
  async (req, res) => {
    // GET: verificación del webhook por Meta Developer Portal
    if (req.method === 'GET') {
      const mode = req.query['hub.mode'];
      const token = req.query['hub.verify_token'];
      const challenge = req.query['hub.challenge'];
      const expected = whatsappVerifyToken.value();
      if (mode === 'subscribe' && token && expected && token === expected) {
        console.log('✅ WhatsApp webhook verificado por Meta');
        return res.status(200).send(String(challenge));
      }
      console.warn('⚠️ WhatsApp webhook: token de verificación inválido');
      return res.status(403).send('Forbidden');
    }

    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    const appSecret = whatsappAppSecret.value();
    if (appSecret) {
      const raw = req.rawBody || Buffer.from(typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {}));
      const ok = verifyWhatsAppHubSignature(raw, req.get('x-hub-signature-256'), appSecret);
      if (!ok) {
        console.warn('⚠️ WhatsApp webhook CF: firma X-Hub-Signature-256 inválida');
        return res.status(403).send('Forbidden');
      }
    } else {
      console.error('⚠️ WHATSAPP_APP_SECRET no configurado: el webhook CF acepta eventos sin firma');
    }

    try {
      const body = req.body;
      if (body?.object === 'whatsapp_business_account') {
        for (const entry of (body.entry || [])) {
          for (const change of (entry.changes || [])) {
            if (change.field !== 'messages') continue;
            for (const status of (change.value?.statuses || [])) {
              await processWhatsAppStatus(status).catch(e =>
                console.error('❌ Error procesando status WA:', e.message, status)
              );
            }
          }
        }
      }
    } catch (e) {
      console.error('❌ Error en whatsappWebhook:', e.message);
    }
    return res.status(200).send('OK');
  }
);

/**
 * Retry automático de certificación en Polygon.
 * Cada 10 minutos busca correos DELIVERED sin polygonCertifications.send
 * (últimas 48 h) y los certifica. Cubre el gap del fire-and-forget de sendEmail.
 */
exports.retryCertifyPendingSends = onSchedule(
  {
    schedule: 'every 10 minutes',
    region: REGION,
    secrets: [polygonCertifySecret],
    timeoutSeconds: 540,
  },
  async () => {
    const db = getFirestore();
    const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000); // últimas 48 h

    // Consulta de un solo campo — no requiere índice compuesto.
    // Filtramos por fecha en memoria para no tocar docs históricos.
    const snap = await db.collection('mail')
      .where('delivery.state', '==', 'DELIVERED')
      .limit(200)
      .get();

    const pending = snap.docs.filter((doc) => {
      const data = doc.data();
      if (data.polygonCertifications?.send) return false; // ya certificado
      const sentAt = data.tracking?.sentAt?.toDate?.();
      return sentAt && sentAt >= cutoff; // solo últimas 48 h
    });

    if (pending.length === 0) {
      console.log('✅ retryCertifyPendingSends: ningún envío pendiente de certificar');
      return;
    }

    console.log(`🔄 retryCertifyPendingSends: ${pending.length} envíos sin certificar`);

    let ok = 0;
    let fail = 0;
    for (const doc of pending) {
      try {
        const res = await fetch(
          `${APP_HOSTING_URL}/api/polygon/certify-event`,
          certifyEventFetchInit({ docId: doc.id, type: 'send', userId: doc.data().createdBy || 'retry' })
        );
        if (res.ok) {
          ok++;
          console.log(`✅ Certificado (retry): ${doc.id}`);
        } else {
          fail++;
          console.warn(`⚠️ Retry fallido ${doc.id}:`, await res.text());
        }
      } catch (e) {
        fail++;
        console.warn(`⚠️ Retry error ${doc.id}:`, e?.message);
      }
    }

    console.log(`🔄 retryCertifyPendingSends: ${ok} OK, ${fail} fallidos`);
  }
);

/**
 * Red de seguridad: si el Cloud Task de las 9:00 no arrancó el lote, a las 9:15
 * recorre campañas en "enviando" y dispara /api/campaigns/daily-cron.
 */
exports.resumeCampaignDailyTandas = onSchedule(
  {
    schedule: '15 9 * * *',
    timeZone: 'America/Argentina/Buenos_Aires',
    region: REGION,
    secrets: [campaignWorkerSecret],
    timeoutSeconds: 540,
  },
  async () => {
    const secret = (campaignWorkerSecret.value() || '').trim();
    if (!secret) {
      console.error('resumeCampaignDailyTandas: CAMPAIGN_WORKER_SECRET vacío');
      return;
    }
    const res = await fetch(`${APP_HOSTING_URL}/api/campaigns/daily-cron`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Worker-Secret': secret,
      },
      body: '{}',
    });
    const text = await res.text();
    if (!res.ok) {
      console.error('resumeCampaignDailyTandas HTTP', res.status, text.slice(0, 500));
      return;
    }
    console.log('resumeCampaignDailyTandas', text.slice(0, 1500));
  }
);

/** Copia adjuntos y certificados al bucket WORM (5 años, no se pisan ni se borran). */
exports.sealEvidenceObject = onObjectFinalized(
  {
    region: REGION,
    bucket: FIREBASE_STORAGE_BUCKET,
  },
  async (event) => {
    const name = event.data?.name;
    if (!name || !(name.startsWith('pdfs/') || name.startsWith('certificates/'))) return;
    const dest = getStorage().bucket(EVIDENCE_STORAGE_BUCKET).file(name);
    const [exists] = await dest.exists();
    if (exists) {
      console.log('WORM ya sellado:', name);
      return;
    }
    await getStorage().bucket(event.data.bucket).file(name).copy(dest);
    console.log('WORM copiado:', name);
  }
);
