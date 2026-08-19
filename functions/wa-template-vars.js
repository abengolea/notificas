/**
 * Resolución de {{N}} del template Meta a partir de recipientData.
 * "0" es un valor válido; undefined/null/"" no lo son.
 */

function isWaLiteralField(field) {
  const f = String(field || '').trim();
  if (!f) return false;
  if (f.startsWith('=')) return true;
  return !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(f);
}

function waLiteralText(field) {
  const f = String(field || '');
  return f.startsWith('=') ? f.slice(1) : f;
}

/** Texto para Meta. Conserva "0"; vacía solo null/undefined/"". */
function asWaText(v) {
  if (v === undefined || v === null) return '';
  return String(v);
}

function isEmptyWaParam(text) {
  return String(text ?? '').trim() === '';
}

function resolveWhatsAppTemplateValue(field, rd, recipientName, toPhone, readerUrl, senderName) {
  const data = rd || {};
  if (isWaLiteralField(field)) return waLiteralText(field);
  switch (field) {
    case 'nombre':
      return asWaText(data.nombre) || asWaText(recipientName);
    case 'dni':
      return asWaText(data.dni);
    case 'legajo':
      return asWaText(data.legajo);
    case 'email':
      return asWaText(data.email);
    case 'telefono':
      return asWaText(data.telefono) || asWaText(toPhone);
    case 'dias':
    case 'dias_atraso':
      return asWaText(data.dias) || asWaText(data.dias_atraso);
    case 'fecha':
      return asWaText(data.fecha);
    case 'monto':
      return asWaText(data.monto);
    case 'cuotas':
      return asWaText(data.cuotas);
    case 'remitente':
    case 'empresa':
      return asWaText(senderName);
    case 'url_lectura':
    case 'boton_url':
      return asWaText(readerUrl);
    default:
      return asWaText(data[field]);
  }
}

/**
 * Arma parameters del BODY y rechaza vacíos (Meta 131008).
 * @returns {{ parameters: object[], bodyFields: string[]|null, resolved: object[], error: object|null }}
 */
function buildWhatsAppBodyParameters({
  templateVariables,
  urlButton,
  recipientData,
  recipientName,
  toPhone,
  readerUrl,
  senderName,
}) {
  const rd = recipientData || {};
  const hasCustomVars = Array.isArray(templateVariables);
  const bodyFields = hasCustomVars
    ? templateVariables.filter((field) => !(urlButton && (field === 'url_lectura' || field === 'boton_url')))
    : null;

  let parameters;
  if (bodyFields) {
    parameters = bodyFields.map((field) => ({
      type: 'text',
      text: String(
        resolveWhatsAppTemplateValue(field, rd, recipientName, toPhone, readerUrl, senderName)
      ).substring(0, 1024),
    }));
  } else if (!urlButton) {
    parameters = [
      { type: 'text', text: String(recipientName || '').substring(0, 50) },
      { type: 'text', text: String(senderName || '').substring(0, 50) },
      { type: 'text', text: String(readerUrl || '') },
    ];
  } else {
    parameters = [];
  }

  const labels = bodyFields || ['nombre', 'remitente', 'url'];
  const resolved = parameters.map((p, i) => ({
    n: i + 1,
    field: labels[i] || 'texto',
    text: p.text,
  }));
  console.log('WhatsApp template params', JSON.stringify(resolved));

  const emptyParam = parameters.findIndex((p) => isEmptyWaParam(p.text));
  if (emptyParam >= 0) {
    const fieldLabel = labels[emptyParam] || 'texto';
    return {
      parameters,
      bodyFields,
      resolved,
      error: {
        code: 131008,
        message: `(#131008) Variable {{${emptyParam + 1}}} (${fieldLabel}) está vacía. Meta no acepta parámetros vacíos. Quitá esa variable o completá el dato del destinatario.`,
      },
    };
  }
  return { parameters, bodyFields, resolved, error: null };
}

module.exports = {
  asWaText,
  isEmptyWaParam,
  isWaLiteralField,
  waLiteralText,
  resolveWhatsAppTemplateValue,
  buildWhatsAppBodyParameters,
};
