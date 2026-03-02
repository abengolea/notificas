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
    // Template con 3 variables: {{1}}=nombre, {{2}}=remitente, {{3}}=url
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
            { type: 'text', text: (recipientName || 'estimado/a').substring(0, 50) },
            { type: 'text', text: (senderName || 'Notificas.com').substring(0, 50) },
            { type: 'text', text: readerUrl }
          ]
        }]
      }
    };
  } else {
    const body = `Hola ${recipientName || 'estimado/a'},

${senderName || 'Notificas.com'} te ha enviado una notificación digital certificada.

Accede aquí: ${readerUrl}

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

const transporter = nodemailer.createTransport({
  host: 'vps-1711372-x.dattaweb.com',
  port: 587,
  secure: false,
  auth: {
    user: 'contacto@notificas.com',
    pass: '3JF9x*a2xS'
  }
});

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
    
    // Procesar solo URLs HTTP/HTTPS válidas con tracking
    const encoded = base64UrlEncode(cleanHref);
    const redirectUrl = `${LINK_REDIRECT_URL}?msg=${encodeURIComponent(docId)}&u=${encoded}&k=${encodeURIComponent(token)}`;
    $(el).attr('href', redirectUrl);
    processedCount++;
  });
  
  console.log(`🔗 Tracking: ${processedCount} enlaces procesados, ${replacedCount} enlaces inválidos reemplazados, ${ignoredCount} ignorados (mailto/tel/js)`);

  // Tracking pixel URL removed
  // Tracking pixel tag removed

  const confirmUrl = `${CONFIRM_READ_URL}?msg=${encodeURIComponent(docId)}&k=${encodeURIComponent(token)}`;
  const confirmBlock = `<p style="margin-top:24px"><a href="${confirmUrl}" target="_blank" rel="noopener">Confirmar lectura</a></p>`;
  if ($('body').length > 0) $('body').append(confirmBlock);
  else $.root().append(confirmBlock);

  return $.html();
}





exports.sendEmail = onRequest(
  { region: REGION, concurrency: 1, secrets: [whatsappAccessToken, whatsappPhoneNumberId] },
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
      // Reemplazar TODOS los placeholders de enlaces con el readerUrl real usando cheerio
      const $ = cheerio.load(htmlOriginal, { decodeEntities: false });
      
      // Reemplazar TODOS los href="#" con readerUrl
      $('a[href="#"]').each((_, el) => {
        const $el = $(el);
        const text = $el.text().trim();
        
        // Si es un botón "Leer Notificacion", mantener la clase btn
        if (text.toLowerCase().includes('leer notificacion')) {
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

Este correo no incluye adjuntos por razones de confidencialidad. La notificacion, sus metadatos de envio, recepcion y lectura quedan certificados y registrados en la red Blockchain a traves de Notificas.com. Esta constancia tecnica no implica conformidad con el contenido.

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
      console.log('📧 Configuración SMTP:', { host: transporter.options.host, port: transporter.options.port });
      
      const result = await transporter.sendMail(mailOptions);
      
      console.log('📧 Resultado del envío:', result);
      
      // Verificar que el email se envió correctamente
      if (!result.messageId) {
        console.error('❌ Error: No se recibió messageId del servidor de correo');
        throw new Error('No se recibió messageId del servidor de correo');
      }

      // Crear movimiento inicial de envío
      const initialMovement = {
        id: crypto.randomUUID(),
        type: 'email_sent',
        description: `Notificar vía e-mail: ${to}`,
        timestamp: new Date().toISOString(),
        userAgent: 'Server',
        clientIP: 'Server',
        forwardedIPs: [],
        realIP: 'Server',
        browser: 'Server',
        recipientEmail: to
      };

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
        // Guardar el HTML ORIGINAL del mensaje para que el lector vea el contenido real
        message: {
          ...emailData.message,
          html: htmlOriginal
        },
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
            const resultWA = await sendWhatsAppNotification(
              token,
              phoneId,
              templateName || null,
              templateLang,
              recipientPhone,
              readerUrl,
              emailData.senderName || from,
              emailData.recipientName || 'Usuario'
            );
            if (resultWA && typeof resultWA === 'string') {
              whatsappId = resultWA;
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

exports.trackOpen = onRequest({ region: REGION }, async (req, res) => {
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
        const certifyRes = await fetch(certifyUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ docId: String(msg), type: 'receive', userId: data?.recipientEmail })
        });
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

exports.linkRedirect = onRequest({ region: REGION }, async (req, res) => {
  try {
    const { msg, u, k } = req.query;
    console.log('🔗 linkRedirect called with:', { msg, u, k });
    
    if (!msg || !u || !k) return res.status(400).send('Missing params');

    // VALIDACIÓN TEMPRANA: Verificar que el parámetro codificado tenga una longitud razonable
    // "#" codificado en base64 es "Iw==" (4 caracteres), muy corto para ser una URL real
    const encodedUrl = String(u);
    if (!encodedUrl || encodedUrl.length < 10) {
      console.log(`⚠️ URL codificada demasiado corta (${encodedUrl.length} chars), probablemente inválida. Redirigiendo sin tracking.`);
      const fallbackUrl = `${APP_HOSTING_URL}/reader/${encodeURIComponent(String(msg))}?k=${encodeURIComponent(String(k))}`;
      return res.redirect(302, fallbackUrl);
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
        url = `${APP_HOSTING_URL}/reader/${encodeURIComponent(String(msg))}?k=${encodeURIComponent(String(k))}`;
        isOriginalUrlValid = false;
      } else if (decodedUrl.match(/^https?:\/\//i)) {
        // URL HTTP/HTTPS válida
        url = decodedUrl;
        isOriginalUrlValid = true;
      } else {
        // URL relativa u otro tipo inválido
        console.log('⚠️ URL decodificada no es HTTP/HTTPS válida, redirigiendo SIN tracking');
        url = `${APP_HOSTING_URL}/reader/${encodeURIComponent(String(msg))}?k=${encodeURIComponent(String(k))}`;
        isOriginalUrlValid = false;
      }
    } catch (decodeError) {
      console.error('❌ Error decoding URL:', decodeError);
      // Si falla la decodificación, construir URL del reader basada en el docId
      url = `${APP_HOSTING_URL}/reader/${encodeURIComponent(String(msg))}?k=${encodeURIComponent(String(k))}`;
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
        .filter(m => m.type === 'link_clicked' && m.description && m.description.includes(decodedUrl))
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
      
      // Crear movimiento detallado usando la URL original decodificada (no la reemplazada)
      const movement = {
        id: movementId,
        type: 'link_clicked',
        description: `Click en enlace: ${decodedUrl}`,
        timestamp: new Date().toISOString(),
        userAgent: userAgent,
        clientIP: clientIP,
        forwardedIPs: forwardedIPs,
        realIP: realIP,
        browser: extractBrowserInfo(userAgent),
        recipientEmail: data.recipientEmail || 'Unknown'
      };
      
      await docRef.update({
        'tracking.clickCount': FieldValue.increment(1),
        'tracking.lastClickAt': FieldValue.serverTimestamp(),
        'tracking.movements': [...existingMovements, movement]
      });
      
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

exports.confirmRead = onRequest({ region: REGION }, async (req, res) => {
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
      const certifyRes = await fetch(certifyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ docId: String(msg), type: 'read', userId: data?.recipientEmail })
      });
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
exports.processIncomingEmail = onRequest({ region: REGION }, async (req, res) => {
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
    
    console.log('✅ Asunto parseado:', parsed);
    
    // Verificar si ya existe un correo similar para evitar duplicados
    const existingQuery = await db.collection('mail')
      .where('senderName', '==', user.email)
      .where('message.subject', '==', parsed.actualSubject)
      .where('recipientEmail', '==', parsed.recipient)
      .limit(1)
      .get();
    
    if (!existingQuery.empty) {
      console.log('⚠️ Correo similar ya existe, evitando duplicado');
      const existingDoc = existingQuery.docs[0];
      return res.status(200).json({ 
        success: true, 
        messageId: existingDoc.data().delivery?.info,
        docId: existingDoc.id,
        recipient: parsed.recipient,
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
      recipientName: parsed.recipient.split('@')[0],
      recipientEmail: parsed.recipient,
      readUrl: readerUrl,
      fallbackUrl: readerUrl,
      year: new Date().getFullYear(),
      docId: docId,
      trackingToken: trackingToken,
      trackingBaseUrl: TRACKING_BASE_URL
    });
    
    // Generar versión de texto plano completa con toda la información
    const recipientName = parsed.recipient.split('@')[0];
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

Este correo no incluye adjuntos por razones de confidencialidad. La notificacion, sus metadatos de envio, recepcion y lectura quedan certificados y registrados en la red Blockchain a traves de Notificas.com. Esta constancia tecnica no implica conformidad con el contenido.

Para dejar constancia de que ha accedido al mensaje, puede utilizar el siguiente enlace:
Confirmar lectura: ${readerUrl}

${new Date().getFullYear()} Notificas.com
Este mensaje fue destinado a ${parsed.recipient}. Si no reconoce esta notificacion, ignore este correo o responda a contacto@notificas.com.`;
    
    // Enviar el correo certificado
    const mailOptions = {
      from: 'contacto@notificas.com',
      to: parsed.recipient,
      subject: parsed.actualSubject,
      text: textVersion,
      html: htmlWithTracking,
      replyTo: user.email
    };
    
    console.log('📧 Enviando correo certificado a:', parsed.recipient);
    const result = await transporter.sendMail(mailOptions);
    
    if (!result.messageId) {
      throw new Error('No se recibió messageId del servidor de correo');
    }
    
    // Guardar en Firestore
    await docRef.set({
      to: [parsed.recipient],
      from: 'contacto@notificas.com',
      senderName: user.email,
      recipientName: parsed.recipient.split('@')[0],
      recipientEmail: parsed.recipient,
      message: {
        subject: parsed.actualSubject,
        html: htmlContent,
        text: text || htmlContent.replace(/<[^>]*>/g, '')
      },
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
        messageId: result.messageId
      },
      readerUrl,
      createdAt: FieldValue.serverTimestamp(),
      timestamp: new Date().toISOString(),
      source: 'external_email', // Marcar como correo enviado desde email externo
      sourceLabel: 'Enviado desde Gmail',
      sourceIcon: '📧'
    });
    
    console.log('✅ Correo certificado enviado:', result.messageId);
    
    res.status(200).json({ 
      success: true, 
      messageId: result.messageId,
      docId: docId,
      recipient: parsed.recipient,
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
