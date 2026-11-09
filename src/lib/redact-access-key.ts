import type { WhatsAppSentContent } from './whatsapp-evidence';

/**
 * La clave `k` de un enlace del lector (`/reader/ID?k=…`, `/linkRedirect?…&k=…`) es una llave:
 * quien la tenga entra como si fuera el destinatario. Los documentos que se descargan
 * (certificado, anexos) NO deben imprimirla: se muestra solo una referencia no reversible.
 */
export const REDACTED_ACCESS_KEY = '[clave reservada]';

const K_QUERY_PARAM = /([?&]k=)([^&\s#"'<>)\]]+)/gi;

/** Reemplaza el valor de `k=` en cualquier URL del texto y, si se conoce, el token literal. */
export function maskAccessKeys(text: string, knownToken?: string | null): string {
  if (!text) return text;
  let out = text.replace(K_QUERY_PARAM, `$1${REDACTED_ACCESS_KEY}`);
  const token = typeof knownToken === 'string' ? knownToken.trim() : '';
  if (token.length >= 8) out = out.split(token).join(REDACTED_ACCESS_KEY);
  return out;
}

/** Copia del contenido de WhatsApp apta para imprimir: sin la clave en botones, variables ni globo. */
export function redactWhatsAppSentForPrint(
  sent: WhatsAppSentContent,
  knownToken?: string | null
): WhatsAppSentContent {
  const m = (s: string | null) => (s == null ? s : maskAccessKeys(s, knownToken));
  return {
    ...sent,
    renderedBody: m(sent.renderedBody),
    renderedHeader: m(sent.renderedHeader),
    renderedFooter: m(sent.renderedFooter),
    variables: sent.variables.map((v) => ({ ...v, value: maskAccessKeys(v.value, knownToken) })),
    buttons: sent.buttons.map((b) => ({
      ...b,
      url: m(b.url),
      urlParameter: m(b.urlParameter),
    })),
  };
}
