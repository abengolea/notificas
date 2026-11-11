'use strict';

/**
 * Espejo mínimo de src/lib/message-kind.ts (las Functions son otro paquete y no importan de src).
 * Tipo de mensaje que elige quien envía: notificación, comunicación o intimación.
 * Si cambia un texto acá, cambiarlo allá: src/lib/message-kind.test.ts compara ambos.
 */
const MESSAGE_KINDS = ['notificacion', 'comunicacion', 'intimacion'];
const DEFAULT_MESSAGE_KIND = 'notificacion';

const COPY = {
  notificacion: { badge: 'NOTIFICACIÓN', noun: 'notificación', button: 'Acceder a la notificación' },
  comunicacion: { badge: 'COMUNICACIÓN', noun: 'comunicación', button: 'Acceder a la comunicación' },
  intimacion: { badge: 'INTIMACIÓN', noun: 'intimación', button: 'Acceder a la intimación' },
};

function normalizeMessageKind(raw) {
  const v = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  return MESSAGE_KINDS.includes(v) ? v : DEFAULT_MESSAGE_KIND;
}

function messageKindCopy(kind) {
  return COPY[normalizeMessageKind(kind)];
}

function messageDisclaimerText(kind) {
  const { noun } = messageKindCopy(kind);
  return (
    `Importante: este correo contiene una ${noun} cuyo contenido se encuentra disponible en el enlace indicado. ` +
    `Recomendamos acceder y leerla a la brevedad. ` +
    `La falta de acceso al enlace no necesariamente impide que la ${noun} produzca los efectos que correspondan. ` +
    `El envío, el acceso y la lectura quedan registrados.`
  );
}

/** Versión de texto plano del correo (para clientes que no muestran HTML). */
function plainTextNotice({ kind, sender, recipientName, readerUrl, year }) {
  const { badge, noun } = messageKindCopy(kind);
  return `${badge}
Nueva ${noun} para usted
Enviada por ${sender} mediante Notificas.com

Estimado/a ${recipientName},

${sender} le envió una ${noun}. Le recomendamos acceder a su contenido, ya que puede ser relevante para:

- Responder en tiempo y forma.
- Ejercer sus derechos y dejar constancia técnica de acceso.
- Conservar evidencia de recepción y lectura.

Acceder a la ${noun}: ${readerUrl}

Si el botón no funciona, copie y pegue este enlace en su navegador:
${readerUrl}

${messageDisclaimerText(kind)}

La ${noun}, sus metadatos de envío, recepción y lectura quedan certificados y registrados en la red Blockchain a través de Notificas.com. Esta constancia técnica no implica conformidad con el contenido.

Para dejar constancia de que ha accedido al mensaje, puede utilizar el siguiente enlace:
Confirmar lectura: ${readerUrl}

${year} Notificas.com
Si no reconoce esta ${noun}, ignore este correo o responda a contacto@notificas.com.
Visitar nuestra web: https://notificas.com.ar`;
}

module.exports = {
  MESSAGE_KINDS,
  DEFAULT_MESSAGE_KIND,
  normalizeMessageKind,
  messageKindCopy,
  messageDisclaimerText,
  plainTextNotice,
};
