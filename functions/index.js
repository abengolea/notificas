const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret, defineString } = require('firebase-functions/params');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const cheerio = require('cheerio');
const { generateEmailWithTracking } = require('./email-template');

initializeApp();

// Secrets de WhatsApp en Secret Manager (firebase functions:secrets:set)
const whatsappAccessToken = defineSecret('WHATSAPP_ACCESS_TOKEN');
const whatsappPhoneNumberId = defineSecret('WHATSAPP_PHONE_NUMBER_ID');
// Secret SMTP (firebase functions:secrets:set SMTP_PASS)
const smtpPass = defineSecret('SMTP_PASS');
// Mismo valor que App Hosting POLYGON_CERTIFY_SECRET — protege /api/polygon/certify-event
const polygonCertifySecret = defineSecret('POLYGON_CERTIFY_SECRET');
// Token de verificación del webhook de WhatsApp (se define en Meta Developer Portal)
const whatsappVerifyToken = defineSecret('WHATSAPP_VERIFY_TOKEN');
// Template aprobado en Meta (requerido para contactar usuarios fuera de ventana 24h)
const whatsappTemplateName = defineString('WHATSAPP_TEMPLATE_NAME', { default: '' });
const whatsappTemplateLanguage = defineString('WHATSAPP_TEMPLATE_LANGUAGE', { default: 'es_AR' });

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
async function sendWhatsAppNotification(accessToken, phoneNumberId, templateName, templateLang, toPhone, readerUrl, senderName, recipientName) {
  if (!accessToken || !phoneNumberId) {
    console.warn('⚠️ WhatsApp: secrets no configurados en Secret Manager');
    return null;
  }
  const to = formatPhoneForWhatsApp(toPhone);
  if (!to) {
    console.warn('⚠️ Teléfono WhatsApp inválido:', toPhone);
    return null;
  }

  // Meta exige TEMPLATES para iniciar conversación (fuera de ventana 24h)
  const url = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`;
  let payload;
  if (templateName) {
    // Parámetros ya formateados: {{1}} destinatario, {{2}} remitente, {{3}} url
    payload = {
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name: templateName,
        language: { code: templateLang || 'es_AR' },
        components: [{
          type: 'body',
          parameters: [
            { type: 'text', text: recipientName.substring(0, 50) },
            { type: 'text', text: senderName.substring(0, 50) },
            { type: 'text', text: readerUrl }
          ]
        }]
      }
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

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) {
      console.error('❌ Error WhatsApp API:', res.status, JSON.stringify(data, null, 2));
      return { error: data };
    }
    console.log('📱 WhatsApp enviado:', data.messages?.[0]?.id);
    return data.messages?.[0]?.id;
  } catch (err) {
    console.error('❌ Error al enviar WhatsApp:', err.message);
    return { error: { message: err.message } };
  }
}

const REGION = 'us-central1';
const PROJECT_ID = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || 'notificas-f9953';
const TRACKING_BASE_URL = 'https://trackopen-ju7n3yysfq-uc.a.run.app';
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

function injectTrackingIntoHtml(html, docId, token) {
  if (!html) return html;
  const $ = cheerio.load(html, { decodeEntities: false });

  let processedCount = 0;
  let replacedCount = 0;
  let ignoredCount = 0;
  
  // URL del reader para reemplazar enlaces inválidos
  const readerUrl = `${APP_HOSTING_URL}/reader/${encodeURIComponent(docId)}?k=${encodeURIComponent(token)}`;

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    
    // Limpiar y validar el href
    if (!href) {
      ignoredCount++;
      return;
    }
    const cleanHref = href.trim();
    
    // Validar si es una URL HTTP/HTTPS válida (excluyendo mailto, tel, javascript, data)
    const isMailtoOrTel = cleanHref.startsWith('mailto:') || cleanHref.startsWith('tel:');
    const isScriptOrData = cleanHref.startsWith('javascript:') || cleanHref.startsWith('data:');
    const isValidHttpUrl = cleanHref && 
                           cleanHref.match(/^https?:\/\//i) && 
                           !cleanHref.startsWith(`${LINK_REDIRECT_URL}`);
    
    // Si es mailto:, tel:, javascript:, o data:, mantener como está (no reemplazar)
    if (isMailtoOrTel || isScriptOrData) {
      ignoredCount++;
      return;
    }
    
    // Si NO es una URL HTTP válida (incluyendo fragmentos # y enlaces relativos), REEMPLAZAR con readerUrl
    if (!isValidHttpUrl || 
        cleanHref === '' ||
        cleanHref === '#' ||
        cleanHref.startsWith('#')) {
      console.log(`⚠️ Reemplazando enlace inválido/relativo href="${cleanHref}" con readerUrl`);
      $(el).attr('href', readerUrl);
      replacedCount++;
      return;
    }

    // El botón "Acceder a la notificación" pasa por linkRedirect (sin `u`) para registrar link_clicked
    const isReaderUrl = cleanHref.includes('/reader/') && cleanHref.includes(`?k=`);
    if (isReaderUrl) {
      const trackUrl = `${LINK_REDIRECT_URL}?msg=${encodeURIComponent(docId)}&k=${encodeURIComponent(token)}`;
      $(el).attr('href', trackUrl);
      processedCount++;
      return;
    }
    
    // Otras URLs HTTP válidas: usar linkRedirect para tracking de clicks
    const encoded = base64UrlEncode(cleanHref);
    const redirectUrl = `${LINK_REDIRECT_URL}?msg=${encodeURIComponent(docId)}&u=${encoded}&k=${encodeURIComponent(token)}`;
    $(el).attr('href', redirectUrl);
    processedCount++;
  });
  
  console.log(`🔗 Tracking: ${processedCount} enlaces procesados, ${replacedCount} enlaces inválidos reemplazados, ${ignoredCount} ignorados (mailto/tel/js)`);

  // Tracking pixel URL removed
  // Tracking pixel tag removed

  // No agregar "Confirmar lectura" en el email: el usuario lo ve en el reader al acceder

  return $.html();
}





exports.sendEmail = onRequest(
  { region: REGION, concurrency: 1, secrets: [whatsappAccessToken, whatsappPhoneNumberId, smtpPass] },
  async (req, res) => {
    const timestamp = new Date().toISOString();
    console.log(`🔥 [${timestamp}] Firebase Function sendEmail ejecutada`);
    try {
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
      
      // 🚨 VERIFICAR SI YA FUE PROCESADO
      if (emailData.delivery?.state) {
        console.log(`⚠️ Documento ${docId} ya fue procesado, estado:`, emailData.delivery.state);
        return res.status(200).json({ 
          success: true, 
          message: 'Ya fue procesado',
          state: emailData.delivery.state 
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
        from: fromCf,
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
        trackingBaseUrl: TRACKING_BASE_URL
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
        from,
        to,
        subject,
        text: textVersion,
        html: htmlWithTracking,
        replyTo: emailData.replyTo,
        cc: emailData.cc,
        bcc: emailData.bcc
      };

      console.log('📧 Enviando email a:', to);
      console.log('📧 Asunto:', subject);
      const result = await getTransporter().sendMail(mailOptions);
      
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
            const templateName = whatsappTemplateName.value()?.trim() || '';
            const templateLang = whatsappTemplateLanguage.value()?.trim() || 'es_AR';
            const encodedReader = base64UrlEncode(readerUrl);
            const whatsappLink = (() => {
              const waDigits = formatPhoneForWhatsApp(recipientPhone);
              const rParam =
                waDigits && waDigits.length >= 10
                  ? `&r=${encodeURIComponent(base64UrlEncode(waDigits))}`
                  : '';
              return `${LINK_REDIRECT_URL}?msg=${encodeURIComponent(docId)}&u=${encodeURIComponent(encodedReader)}&k=${encodeURIComponent(trackingToken)}&src=whatsapp${rParam}`;
            })();
            const waRecipient = formatWhatsAppRecipientDisplay(emailData.recipientName);
            const waSender = formatWhatsAppSenderDisplay(emailData.senderName || from, from);
            const resultWA = await sendWhatsAppNotification(
              token,
              phoneId,
              templateName || null,
              templateLang,
              recipientPhone,
              whatsappLink,
              waSender,
              waRecipient
            );
            if (resultWA && typeof resultWA === 'string') {
              whatsappId = resultWA;
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
                browser: 'WhatsApp Cloud API',
                recipientEmail: emailData.recipientEmail || 'Unknown',
                whatsappMessageId: whatsappId,
              };
              docRef.update({
                'tracking.whatsappMessageId': whatsappId,
                'tracking.movements': FieldValue.arrayUnion(waMovement),
              }).catch(e => console.warn('⚠️ Error guardando whatsappMessageId:', e.message));
              // Índice para lookup rápido desde el webhook de delivery
              getFirestore().doc(`whatsapp_ids/${whatsappId}`).set({
                mailDocId: docId,
                recipientPhone: formatPhoneForWhatsApp(recipientPhone) || recipientPhone,
                createdAt: FieldValue.serverTimestamp(),
              }).catch(e => console.warn('⚠️ Error guardando whatsapp_ids:', e.message));
            } else if (resultWA && resultWA.error) {
              const err = resultWA.error;
              // Meta: { error: { message: "..." } }
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

      // Devolver respuesta exitosa
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

exports.trackOpen = onRequest({ region: REGION, secrets: [polygonCertifySecret] }, async (req, res) => {
  try {
    const { msg, k } = req.query;
    if (!msg || !k) return res.status(400).send('Missing params');

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
    const movementId = require('crypto').randomUUID();
    
    // Crear movimiento detallado
    const movement = {
      id: movementId,
      type: 'email_opened',
      description: 'Lectura de documento desde link del email',
      timestamp: new Date().toISOString(),
      userAgent: userAgent,
      clientIP: clientIP,
      forwardedIPs: forwardedIPs,
      realIP: realIP,
      browser: extractBrowserInfo(userAgent),
      recipientEmail: data.recipientEmail || 'Unknown'
    };

    // Obtener movimientos existentes o crear array vacío
    const existingMovements = data?.tracking?.movements || [];
    
    await docRef.update({
      'tracking.opened': true,
      'tracking.openedAt': FieldValue.serverTimestamp(),
      'tracking.openCount': FieldValue.increment(1),
      'tracking.movements': [...existingMovements, movement]
    });

    // Certificar recepción (primera apertura) en Polygon
    const wasFirstOpen = !data?.tracking?.opened;
    if (wasFirstOpen) {
      try {
        const certifyUrl = `${APP_HOSTING_URL}/api/polygon/certify-event`;
        const certifyRes = await fetch(certifyUrl, certifyEventFetchInit({
          docId: String(msg),
          type: 'receive',
          userId: data?.recipientEmail,
        }));
        if (!certifyRes.ok) console.warn('⚠️ Polygon certify receive:', await certifyRes.text());
      } catch (e) {
        console.warn('⚠️ Polygon certify receive failed:', e?.message);
      }
    }

    // Generar imagen SVG visible con información del mensaje
    const messageData = data;
    const senderName = messageData.senderName || 'Remitente';
    const subject = messageData.message?.subject || 'Sin asunto';
    const sentDate = messageData.delivery?.time ? new Date(messageData.delivery.time.seconds * 1000).toLocaleDateString('es-ES') : new Date().toLocaleDateString('es-ES');
    
    const svgImage = `
    <svg width="600" height="120" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" style="stop-color:#0D9488;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#14B8A6;stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="600" height="120" fill="url(#grad)" rx="8"/>
      <rect x="1" y="1" width="598" height="118" fill="none" stroke="#ffffff" stroke-width="2" rx="8"/>
      <text x="20" y="30" fill="white" font-family="Arial, sans-serif" font-size="16" font-weight="bold">📧 Notificación Digital Certificada</text>
      <text x="20" y="55" fill="white" font-family="Arial, sans-serif" font-size="12">De: ${senderName}</text>
      <text x="20" y="75" fill="white" font-family="Arial, sans-serif" font-size="12">Asunto: ${subject}</text>
      <text x="20" y="95" fill="white" font-family="Arial, sans-serif" font-size="12">Fecha: ${sentDate}</text>
      <text x="400" y="70" fill="white" font-family="Arial, sans-serif" font-size="14" font-weight="bold">✅ Apertura Certificada</text>
    </svg>`;

    res.set('Content-Type', 'image/svg+xml');
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    return res.status(200).send(svgImage);
  } catch (e) {
    console.error(e);
    return res.status(200).end();
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
  /googleimageproxy/i,
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

exports.linkRedirect = onRequest({ region: REGION, secrets: [polygonCertifySecret] }, async (req, res) => {
  try {
    const { msg, u, k, src, r } = req.query;
    console.log('🔗 linkRedirect called with:', { msg, u: u ? '(set)' : '(none)', k: k ? '(set)' : '(none)', src, r: r ? '(set)' : '' });

    if (!msg || !k) return res.status(400).send('Missing params');

    const userAgentForCheck = req.get('User-Agent') || '';
    if (isKnownScanner(userAgentForCheck)) {
      console.log('🤖 Scanner de email detectado, redirigiendo sin tracking:', userAgentForCheck.substring(0, 80));
      const readerFallback = `${APP_HOSTING_URL}/reader/${encodeURIComponent(String(msg))}?k=${encodeURIComponent(String(k))}`;
      return res.redirect(302, readerFallback);
    }

    const readerUrl = `${APP_HOSTING_URL}/reader/${encodeURIComponent(String(msg))}?k=${encodeURIComponent(String(k))}`;

    // Sin `u`: click directo en el CTA del correo → redirigir al reader y registrar link_clicked
    if (!u) {
      console.log('🔗 Sin parámetro u — click en CTA del correo, redirigiendo al reader');
      const db = getFirestore();
      const docRef = db.collection('mail').doc(String(msg));
      const snap = await docRef.get();
      if (snap.exists) {
        const data = snap.data() || {};
        const token = data?.tracking?.token;
        if (token && token === String(k)) {
          const existingMovements = data?.tracking?.movements || [];
          const clientIP = req.get('X-Forwarded-For')?.split(',')[0]?.trim() || req.get('X-Real-IP') || req.connection.remoteAddress || 'Unknown';
          const now = Date.now();
          const recentDuplicate = existingMovements.find(m =>
            m.type === 'link_clicked' &&
            !m.description?.includes('http') &&
            new Date(m.timestamp).getTime() > now - 5000 &&
            m.clientIP === clientIP
          );
          if (!recentDuplicate) {
            const movement = {
              id: crypto.randomUUID(),
              type: 'link_clicked',
              description: 'Click en botón del correo para acceder a la notificación',
              source: src || 'email',
              timestamp: new Date().toISOString(),
              userAgent: userAgentForCheck,
              clientIP,
              forwardedIPs: req.get('X-Forwarded-For') ? req.get('X-Forwarded-For').split(',').map(ip => ip.trim()) : [],
              realIP: req.get('X-Real-IP') || 'Unknown',
              browser: extractBrowserInfo(userAgentForCheck),
              recipientEmail: data.recipientEmail || 'Unknown',
            };
            await docRef.update({
              'tracking.clickCount': FieldValue.increment(1),
              'tracking.lastClickAt': FieldValue.serverTimestamp(),
              'tracking.movements': [...existingMovements, movement],
            });
            console.log('✅ link_clicked (CTA) registrado');
          } else {
            console.log('⚠️ Duplicate CTA click dentro de 5s, skipping');
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
    const snap = await docRef.get();
    
    if (!snap.exists) {
      console.log('❌ Document not found:', msg);
      return res.redirect(302, url);
    }

    const data = snap.data() || {};
    const token = data?.tracking?.token;
    console.log('🔑 Token comparison:', { 
      storedToken: token, 
      providedToken: String(k), 
      match: token === String(k) 
    });
    
    // NO registrar tracking si la URL original era inválida (como "#")
    // Esto previene registrar clicks en enlaces inválidos o fragmentos
    if (!isOriginalUrlValid) {
      console.log('⚠️ Invalid URL detected (was: "' + decodedUrl + '"), skipping tracking completely');
      return res.redirect(302, url);
    }
    
    // Solo registrar tracking si el token es válido Y la URL original era válida
    if (token && token === String(k)) {
      console.log('✅ Token valid and URL valid, checking for duplicates');
      
      // Obtener movimientos existentes
      const existingMovements = data?.tracking?.movements || [];
      
      // Obtener información del usuario para deduplicación
      const userAgent = req.get('User-Agent') || 'Unknown';
      const clientIP = req.get('X-Forwarded-For')?.split(',')[0]?.trim() || 
                       req.get('X-Real-IP') || 
                       req.connection.remoteAddress || 
                       'Unknown';
      
      // Verificar si hay un click reciente del mismo enlace desde la misma IP
      // (dentro de los últimos 5 segundos)
      const now = Date.now();
      const fiveSecondsAgo = now - 5000;
      
      const recentDuplicate = existingMovements
        .filter(m => {
          const isLinkType = m.type === 'link_clicked' || m.type === 'whatsapp_link_clicked';
          const matchesUrl = m.type === 'whatsapp_link_clicked' || (m.description && m.description.includes(decodedUrl));
          return isLinkType && matchesUrl;
        })
        .find(m => {
          const movementTime = new Date(m.timestamp).getTime();
          const sameIP = m.clientIP === clientIP || m.realIP === clientIP;
          return movementTime > fiveSecondsAgo && sameIP;
        });
      
      if (recentDuplicate) {
        console.log('⚠️ Duplicate click detected within 5 seconds, skipping tracking');
        return res.redirect(302, url);
      }
      
      console.log('✅ No duplicate found, updating tracking');
      
      // Obtener información detallada del usuario
      const forwardedIPs = req.get('X-Forwarded-For') ? req.get('X-Forwarded-For').split(',').map(ip => ip.trim()) : [];
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

      const isWhatsApp = src === 'whatsapp';
      const movement = {
        id: movementId,
        type: isWhatsApp ? 'whatsapp_link_clicked' : 'link_clicked',
        description: isWhatsApp
          ? recipientPhoneVerified && recipientPhoneFromLink
            ? `Click en WhatsApp (enlace generado para +${recipientPhoneFromLink})`
            : 'Click en el mensaje de WhatsApp para acceder a la notificación'
          : `Click en enlace del correo: ${decodedUrl}`,
        source: src || 'email',
        timestamp: new Date().toISOString(),
        userAgent: userAgent,
        clientIP: clientIP,
        forwardedIPs: forwardedIPs,
        realIP: realIP,
        browser: extractBrowserInfo(userAgent),
        recipientEmail: data.recipientEmail || 'Unknown',
        recipientPhone: recipientPhoneFromLink || undefined,
        recipientPhoneVerified: recipientPhoneVerified
      };
      const updateData = {
        'tracking.clickCount': FieldValue.increment(1),
        'tracking.lastClickAt': FieldValue.serverTimestamp(),
        'tracking.movements': [...existingMovements, movement]
      };
      if (isWhatsApp && !data?.tracking?.opened) {
        updateData['tracking.opened'] = true;
        updateData['tracking.openedAt'] = FieldValue.serverTimestamp();
        updateData['tracking.openCount'] = FieldValue.increment(1);
        try {
          const certifyUrl = `${APP_HOSTING_URL}/api/polygon/certify-event`;
          const certifyRes = await fetch(certifyUrl, certifyEventFetchInit({
            docId: String(msg),
            type: 'receive',
            userId: data?.recipientEmail,
          }));
          if (!certifyRes.ok) console.warn('⚠️ Polygon certify receive (WhatsApp):', await certifyRes.text());
        } catch (e) {
          console.warn('⚠️ Polygon certify receive failed:', e?.message);
        }
      }
      await docRef.update(updateData);
      
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
});

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
      description: 'Acreditación en juicio',
      timestamp: new Date().toISOString(),
      userAgent: userAgent,
      clientIP: clientIP,
      forwardedIPs: forwardedIPs,
      realIP: realIP,
      browser: extractBrowserInfo(userAgent),
      recipientEmail: data.recipientEmail || 'Unknown'
    };

    // Obtener movimientos existentes o crear array vacío
    const existingMovements = data?.tracking?.movements || [];
    
    await docRef.update({
      'tracking.readConfirmed': true,
      'tracking.readConfirmedAt': FieldValue.serverTimestamp(),
      'tracking.movements': [...existingMovements, movement]
    });

    // Certificar lectura en Polygon
    try {
      const certifyUrl = `${APP_HOSTING_URL}/api/polygon/certify-event`;
      const certifyRes = await fetch(certifyUrl, certifyEventFetchInit({
        docId: String(msg),
        type: 'read',
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

// Función para procesar correos entrantes desde clientes de email externos
exports.processIncomingEmail = onRequest({ region: REGION, secrets: [smtpPass] }, async (req, res) => {
  try {
    console.log('📧 Procesando correo entrante:', req.body);
    
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
      trackingBaseUrl: TRACKING_BASE_URL
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
      from: 'contacto@notificas.com',
      to: recipientNorm,
      subject: parsed.actualSubject,
      text: textVersion,
      html: htmlWithTracking,
      replyTo: user.email
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
  const idDoc = await db.doc(`whatsapp_ids/${wamid}`).get();
  if (!idDoc.exists) {
    console.warn(`⚠️ No se encontró mailDocId para wamid=${wamid}`);
    return;
  }

  const { mailDocId } = idDoc.data();
  const mailRef = db.doc(`mail/${mailDocId}`);
  const mailSnap = await mailRef.get();
  if (!mailSnap.exists) {
    console.warn(`⚠️ Documento mail/${mailDocId} no encontrado`);
    return;
  }

  const data = mailSnap.data() || {};
  const existingMovements = data?.tracking?.movements || [];

  // Dedupe: no registrar el mismo status dos veces para el mismo wamid
  const alreadyRecorded = existingMovements.some(
    (m) => m.whatsappMessageId === wamid && m.type === `whatsapp_${statusType}`
  );
  if (alreadyRecorded) {
    console.log(`⚠️ whatsapp_${statusType} ya registrado para wamid=${wamid}, skip`);
    return;
  }

  const typeMap = { delivered: 'whatsapp_delivered', read: 'whatsapp_read', failed: 'whatsapp_failed' };
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
    userAgent: 'WhatsApp Cloud API',
    clientIP: 'Server',
    forwardedIPs: [],
    realIP: 'Server',
    browser: 'WhatsApp',
    recipientEmail: data.recipientEmail || 'Unknown',
    recipientPhone,
    whatsappMessageId: wamid,
  };

  const update = { 'tracking.movements': [...existingMovements, movement] };
  if (statusType === 'delivered') {
    update['tracking.whatsappDelivered'] = true;
    update['tracking.whatsappDeliveredAt'] = FieldValue.serverTimestamp();
  } else if (statusType === 'read') {
    update['tracking.whatsappRead'] = true;
    update['tracking.whatsappReadAt'] = FieldValue.serverTimestamp();
  }

  await mailRef.update(update);
  console.log(`✅ whatsapp_${statusType} registrado en mail/${mailDocId}`);
}

exports.whatsappWebhook = onRequest(
  { region: REGION, secrets: [whatsappVerifyToken] },
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

    // Responder 200 inmediatamente — Meta reintenta si no recibe respuesta rápida
    res.status(200).send('OK');

    try {
      const body = req.body;
      if (body?.object !== 'whatsapp_business_account') return;

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
    } catch (e) {
      console.error('❌ Error en whatsappWebhook:', e.message);
    }
  }
);
