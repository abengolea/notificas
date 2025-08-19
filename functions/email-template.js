// Template de email para Firebase Functions
// Mantiene los mismos colores y diseño que el template del frontend

function generateEmailHtml(params) {
  const {
    senderName = 'Notificas',
    recipientName = 'Usuario',
    recipientEmail = '',
    readUrl = '',
    fallbackUrl = '',
    year = new Date().getFullYear()
  } = params;

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>Nueva notificacion digital</title>
  <style>
    body, table, td, a { font-family: "Inter", -apple-system, Segoe UI, Roboto, Arial, sans-serif !important; }
    body { margin: 0; padding: 0; background-color: #F8FAFC; color: #1E293B; }
    .wrapper { width: 100%; table-layout: fixed; background-color: #F8FAFC; padding: 24px 0; }
    .container { width: 100%; max-width: 640px; background: #ffffff; margin: 0 auto; border-radius: 8px; overflow: hidden; border: 1px solid #E2E8F0; }
    .header { background: #0D9488; color: #ffffff; padding: 20px 24px; }
    .badge { display: inline-block; background: #1E3A8A; color: #fff; font-size: 12px; letter-spacing: .4px; padding: 4px 8px; border-radius: 999px; }
    .title { margin: 10px 0 0 0; font-size: 20px; line-height: 1.3; font-weight: 700; }
    .content { padding: 24px; }
    .lead { font-size: 16px; line-height: 1.6; margin: 0 0 16px 0; }
    .list { padding-left: 18px; margin: 0 0 16px 0; }
    .btn { display: inline-block; background: #0D9488; color: #ffffff !important; text-decoration: none; padding: 12px 20px; border-radius: 8px; font-weight: 700; }
    .btn:hover { background: #0F766E; }
    .muted { color: #64748B; font-size: 12px; line-height: 1.6; }
    .divider { height: 1px; background: #E2E8F0; margin: 20px 0; }
    .footer { padding: 16px 24px 24px; }
  </style>
</head>
<body>
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
    Notificacion digital enviada por {{senderName}} a traves de Notificas.com
  </div>
  <table role="presentation" class="wrapper" width="100%" cellspacing="0" cellpadding="0">
    <tr>
      <td align="center">
        <table role="presentation" class="container" cellspacing="0" cellpadding="0">
          <tr>
            <td class="header">
              <span class="badge">NOTIFICACION</span>
              <div class="title">Nueva comunicacion para usted</div>
              <div style="margin-top:6px;font-size:13px;opacity:.9;">
                Enviada por <strong>{{senderName}}</strong> mediante <strong>Notificas.com</strong>
              </div>
            </td>
          </tr>
          <tr>
            <td class="content">
              <p class="lead">Estimado/a {{recipientName}},</p>
              <p class="lead">
                Ha recibido una <strong>comunicacion fehaciente digital</strong> remitida por <strong>{{senderName}}</strong>. 
                Le recomendamos acceder a su contenido, ya que puede ser relevante para:
              </p>
              <ul class="list">
                <li><strong>Responder en tiempo y forma</strong>.</li>
                <li><strong>Ejercer sus derechos</strong> y dejar constancia tecnica de acceso.</li>
                <li><strong>Conservar evidencia</strong> de recepcion y lectura.</li>
              </ul>
              <p style="margin: 20px 0;">
                <a class="btn" href="{{readUrl}}" target="_blank" rel="noopener">Leer Notificacion</a>
              </p>
              <p class="muted">
                Si el boton no funciona, copie y pegue este enlace en su navegador:<br>
                <a href="{{fallbackUrl}}" target="_blank" rel="noopener" style="color:inherit;">{{fallbackUrl}}</a>
              </p>
              <div class="divider"></div>
              <p class="muted">
                Este correo no incluye adjuntos por razones de confidencialidad. La notificacion, sus metadatos de envio, 
                recepcion y lectura quedan <strong>certificados y registrados</strong> en la red Blockchain a traves de Notificas.com. 
                Esta constancia tecnica no implica conformidad con el contenido.
              </p>
              <p class="muted" style="margin-top:12px;">
                Para dejar constancia de que ha accedido al mensaje, puede utilizar el siguiente enlace:<br>
                <a href="{{readUrl}}#confirm" target="_blank" rel="noopener" style="color:inherit;">Confirmar lectura</a>
              </p>
            </td>
          </tr>
          <tr>
            <td class="footer">
              <div class="muted">
                 {{year}} Notificas.com  Este mensaje fue destinado a {{recipientEmail}}. 
                Si no reconoce esta notificacion, ignore este correo o responda a 
                <a href="mailto:contacto@notificas.com" style="color:inherit;">contacto@notificas.com</a>.
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function generateEmailWithTracking(params) {
  const {
    senderName = 'Notificas',
    recipientName = 'Usuario',
    recipientEmail = '',
    readUrl = '',
    fallbackUrl = '',
    year = new Date().getFullYear(),
    docId,
    trackingToken,
    trackingBaseUrl
  } = params;

  // Generar el HTML base usando el mismo sistema de reemplazo que el frontend
  let html = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>Nueva notificacion digital</title>
  <style>
    body, table, td, a { font-family: "Inter", -apple-system, Segoe UI, Roboto, Arial, sans-serif !important; }
    body { margin: 0; padding: 0; background-color: #F8FAFC; color: #1E293B; }
    .wrapper { width: 100%; table-layout: fixed; background-color: #F8FAFC; padding: 24px 0; }
    .container { width: 100%; max-width: 640px; background: #ffffff; margin: 0 auto; border-radius: 8px; overflow: hidden; border: 1px solid #E2E8F0; }
    .header { background: #0D9488; color: #ffffff; padding: 20px 24px; }
    .badge { display: inline-block; background: #1E3A8A; color: #fff; font-size: 12px; letter-spacing: .4px; padding: 4px 8px; border-radius: 999px; }
    .title { margin: 10px 0 0 0; font-size: 20px; line-height: 1.3; font-weight: 700; }
    .content { padding: 24px; }
    .lead { font-size: 16px; line-height: 1.6; margin: 0 0 16px 0; }
    .list { padding-left: 18px; margin: 0 0 16px 0; }
    .btn { display: inline-block; background: #0D9488; color: #ffffff !important; text-decoration: none; padding: 12px 20px; border-radius: 8px; font-weight: 700; }
    .btn:hover { background: #0F766E; }
    .muted { color: #64748B; font-size: 12px; line-height: 1.6; }
    .divider { height: 1px; background: #E2E8F0; margin: 20px 0; }
    .footer { padding: 16px 24px 24px; }
  </style>
</head>
<body>
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
    Notificacion digital enviada por {{senderName}} a traves de Notificas.com
  </div>
  <table role="presentation" class="wrapper" width="100%" cellspacing="0" cellpadding="0">
    <tr>
      <td align="center">
        <table role="presentation" class="container" cellspacing="0" cellpadding="0">
          <tr>
            <td class="header">
              <span class="badge">NOTIFICACION</span>
              <div class="title">Nueva comunicacion para usted</div>
              <div style="margin-top:6px;font-size:13px;opacity:.9;">
                Enviada por <strong>{{senderName}}</strong> mediante <strong>Notificas.com</strong>
              </div>
            </td>
          </tr>
          <tr>
            <td class="content">
              <p class="lead">Estimado/a {{recipientName}},</p>
              <p class="lead">
                Ha recibido una <strong>comunicacion fehaciente digital</strong> remitida por <strong>{{senderName}}</strong>. 
                Le recomendamos acceder a su contenido, ya que puede ser relevante para:
              </p>
              <ul class="list">
                <li><strong>Responder en tiempo y forma</strong>.</li>
                <li><strong>Ejercer sus derechos</strong> y dejar constancia tecnica de acceso.</li>
                <li><strong>Conservar evidencia</strong> de recepcion y lectura.</li>
              </ul>
              <p style="margin: 20px 0;">
                <a class="btn" href="{{readUrl}}" target="_blank" rel="noopener">Leer Notificacion</a>
              </p>
              <p class="muted">
                Si el boton no funciona, copie y pegue este enlace en su navegador:<br>
                <a href="{{fallbackUrl}}" target="_blank" rel="noopener" style="color:inherit;">{{fallbackUrl}}</a>
              </p>
              <div class="divider"></div>
              <p class="muted">
                Este correo no incluye adjuntos por razones de confidencialidad. La notificacion, sus metadatos de envio, 
                recepcion y lectura quedan <strong>certificados y registrados</strong> en la red Blockchain a traves de Notificas.com. 
                Esta constancia tecnica no implica conformidad con el contenido.
              </p>
              <p class="muted" style="margin-top:12px;">
                Para dejar constancia de que ha accedido al mensaje, puede utilizar el siguiente enlace:<br>
                <a href="{{readUrl}}#confirm" target="_blank" rel="noopener" style="color:inherit;">Confirmar lectura</a>
              </p>
            </td>
          </tr>
          <tr>
            <td class="footer">
              <div class="muted">
                 {{year}} Notificas.com  Este mensaje fue destinado a {{recipientEmail}}. 
                Si no reconoce esta notificacion, ignore este correo o responda a 
                <a href="mailto:contacto@notificas.com" style="color:inherit;">contacto@notificas.com</a>.
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  // Reemplazar las variables del template usando el mismo sistema que el frontend
  html = html
    .replace(/\{\{senderName\}\}/g, senderName)
    .replace(/\{\{recipientName\}\}/g, recipientName)
    .replace(/\{\{recipientEmail\}\}/g, recipientEmail)
    .replace(/\{\{readUrl\}\}/g, readUrl)
    .replace(/\{\{fallbackUrl\}\}/g, fallbackUrl)
    .replace(/\{\{year\}\}/g, year.toString());

  // Inyectar tracking en los enlaces
  html = html.replace(
    /href="([^"]+)"/g,
    (match, url) => {
      if (url.startsWith('http') && !url.includes('linkRedirect')) {
        const encoded = Buffer.from(url).toString('base64')
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=+$/g, '');
        const redirectUrl = `${trackingBaseUrl}/linkRedirect?msg=${encodeURIComponent(docId)}&u=${encoded}&k=${encodeURIComponent(trackingToken)}`;
        return `href="${redirectUrl}"`;
      }
      return match;
    }
  );

  // Agregar enlace de confirmación de lectura
  const confirmUrl = `${trackingBaseUrl}/confirmRead?msg=${encodeURIComponent(docId)}&k=${encodeURIComponent(trackingToken)}`;
  const confirmBlock = `<p style="margin-top:24px;text-align:center;"><a href="${confirmUrl}" target="_blank" rel="noopener" style="color:#64748B;text-decoration:none;font-size:12px;">Confirmar lectura</a></p>`;

  // Insertar antes del cierre del body
  html = html.replace('</body>', `${confirmBlock}\n</body>`);

  return html;
}

module.exports = {
  generateEmailHtml,
  generateEmailWithTracking
};
