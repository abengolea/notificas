import type { WhatsAppSentContent } from './whatsapp-evidence';

/**
 * Lo que abre el lector como si fuera el destinatario es una LLAVE:
 *  - la clave `k` de `/reader/ID?k=…` y `/linkRedirect?…&k=…`
 *  - el código corto de `/n/CODE` (se resuelve a mensaje + clave en el servidor)
 * Los documentos que se descargan (certificado, anexos) NO deben imprimirlas: se muestra solo una
 * referencia no reversible.
 */
export const REDACTED_ACCESS_KEY = '[clave reservada]';

const K_QUERY_PARAM = /([?&]k=)([^&\s#"'<>)\]]+)/gi;
/** Código corto de lectura: 8 caracteres alfanuméricos tras `/n/` (ver `read-code.ts`). */
const SHORT_READ_CODE = /(\/n\/)([A-Za-z0-9]{8,})(?![A-Za-z0-9])/g;

type SecretInput = string | null | undefined | Array<string | null | undefined>;

function knownSecretsList(input: SecretInput): string[] {
  const list = Array.isArray(input) ? input : [input];
  return list
    .map((s) => (typeof s === 'string' ? s.trim() : ''))
    .filter((s) => s.length >= 8);
}

/**
 * Tapa toda llave de acceso en el texto: `k=…`, `/n/CODE` y, si se conocen, los valores literales
 * (token y código corto del mensaje) aunque aparezcan sueltos.
 */
export function maskAccessKeys(text: string, knownSecrets?: SecretInput): string {
  if (!text) return text;
  let out = text
    .replace(K_QUERY_PARAM, `$1${REDACTED_ACCESS_KEY}`)
    .replace(SHORT_READ_CODE, `$1${REDACTED_ACCESS_KEY}`);
  for (const secret of knownSecretsList(knownSecrets)) {
    out = out.split(secret).join(REDACTED_ACCESS_KEY);
  }
  return out;
}

/** Copia del contenido de WhatsApp apta para imprimir: sin la llave en botones, variables ni globo. */
export function redactWhatsAppSentForPrint(
  sent: WhatsAppSentContent,
  knownSecrets?: SecretInput
): WhatsAppSentContent {
  const m = (s: string | null) => (s == null ? s : maskAccessKeys(s, knownSecrets));
  return {
    ...sent,
    renderedBody: m(sent.renderedBody),
    renderedHeader: m(sent.renderedHeader),
    renderedFooter: m(sent.renderedFooter),
    variables: sent.variables.map((v) => ({ ...v, value: maskAccessKeys(v.value, knownSecrets) })),
    buttons: sent.buttons.map((b) => ({
      ...b,
      url: m(b.url),
      urlParameter: m(b.urlParameter),
    })),
  };
}
