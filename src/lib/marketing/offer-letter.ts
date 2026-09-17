import type { MergeFields } from "./html";

export const OUTREACH_SUBJECT =
  "Constancia de lo que enviás, a quién y cuándo";

export const OUTREACH_PREHEADER =
  "Email y WhatsApp con rastro verificable. No reemplaza una carta documento.";

export function outreachOfferBodyHtml(_fields: MergeFields): string {
  const site = "https://notificas.com.ar";
  return `<p style="margin:0 0 22px;font-family:Georgia,'Iowan Old Style','Palatino Linotype','Times New Roman',serif;font-size:28px;line-height:1.22;color:#17303a;font-weight:normal;">
  Un rastro de lo que salió,<br />a quién y cuándo.
</p>
<p style="margin:0 0 18px;font-family:Georgia,'Iowan Old Style','Palatino Linotype','Times New Roman',serif;font-size:17px;line-height:1.6;color:#243943;">
  Hola {{nombre}},
</p>
<p style="margin:0 0 16px;font-family:Georgia,'Iowan Old Style','Palatino Linotype','Times New Roman',serif;font-size:17px;line-height:1.65;color:#243943;">
  En Notificas las empresas despachan comunicaciones por <strong>email</strong> y <strong>WhatsApp</strong> y queda constancia de qué se envió, a quién y cuándo. Del texto sale una huella digital. Esa huella puede anclarse en Polygon, una red pública que no se reescribe.
</p>
<p style="margin:0 0 16px;font-family:Georgia,'Iowan Old Style','Palatino Linotype','Times New Roman',serif;font-size:17px;line-height:1.65;color:#243943;">
  No reemplaza una carta documento. Es más rápido, escala a cientos o miles de destinatarios, y deja un expediente que se puede verificar después: texto, destinos y los eventos que el canal informa.
</p>
<p style="margin:0 0 28px;font-family:Georgia,'Iowan Old Style','Palatino Linotype','Times New Roman',serif;font-size:17px;line-height:1.65;color:#243943;">
  Sirve para mora, intimaciones, avisos masivos y comunicaciones corporativas. Las campañas se cotizan caso por caso.
</p>
<table role="presentation" cellspacing="0" cellpadding="0" border="0">
  <tr>
    <td style="border-radius:4px;background:#0d7c78;">
      <a href="${site}" target="_blank" rel="noopener" style="display:inline-block;padding:13px 22px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1;font-weight:700;letter-spacing:0.02em;color:#ffffff;text-decoration:none;">
        Ver cómo funciona
      </a>
    </td>
  </tr>
</table>
<p style="margin:22px 0 0;font-family:Georgia,'Iowan Old Style','Palatino Linotype','Times New Roman',serif;font-size:16px;line-height:1.55;color:#4a5d66;">
  Si querés una cotización, respondé este correo.
</p>`;
}

export function outreachOfferText(fields: MergeFields): string {
  const nombre = fields.nombre || "equipo";
  return `Hola ${nombre},

En Notificas las empresas despachan comunicaciones por email y WhatsApp y queda constancia de qué se envió, a quién y cuándo. Del texto sale una huella digital. Esa huella puede anclarse en Polygon, una red pública que no se reescribe.

No reemplaza una carta documento. Es más rápido, escala a cientos o miles de destinatarios, y deja un expediente que se puede verificar después: texto, destinos y los eventos que el canal informa.

Sirve para mora, intimaciones, avisos masivos y comunicaciones corporativas. Las campañas se cotizan caso por caso.

Ver cómo funciona: https://notificas.com.ar

Si querés una cotización, respondé este correo.`;
}
