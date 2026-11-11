/**
 * Tipo de mensaje que elige quien envía: define cómo se nombra en el correo (etiqueta, frase, botón, aviso).
 * Un solo lugar para los textos: así el correo no dice "notificación" en un lado y "comunicación" en otro.
 *
 * Las plantillas de WhatsApp NO dependen de esto: su texto lo aprueba Meta y no se puede variar libremente.
 * `functions/message-kind.js` es un espejo mínimo para las Functions; si cambia un texto acá, cambiarlo allá.
 */
export const MESSAGE_KINDS = ['notificacion', 'comunicacion', 'intimacion'] as const;

export type MessageKind = (typeof MESSAGE_KINDS)[number];

export const DEFAULT_MESSAGE_KIND: MessageKind = 'notificacion';

/** Cualquier valor que no sea un tipo conocido (mensajes viejos, datos sueltos) cae en el tipo por defecto. */
export function normalizeMessageKind(raw: unknown): MessageKind {
  const v = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  return (MESSAGE_KINDS as readonly string[]).includes(v) ? (v as MessageKind) : DEFAULT_MESSAGE_KIND;
}

export type MessageKindCopy = {
  /** Etiqueta de la cabecera del correo. */
  badge: string;
  /** Sustantivo en minúscula, siempre femenino ("una", "la"). */
  noun: string;
  /** Texto del botón de acceso. */
  button: string;
};

const COPY: Record<MessageKind, MessageKindCopy> = {
  notificacion: { badge: 'NOTIFICACIÓN', noun: 'notificación', button: 'Acceder a la notificación' },
  comunicacion: { badge: 'COMUNICACIÓN', noun: 'comunicación', button: 'Acceder a la comunicación' },
  intimacion: { badge: 'INTIMACIÓN', noun: 'intimación', button: 'Acceder a la intimación' },
};

export function messageKindCopy(kind: unknown): MessageKindCopy {
  return COPY[normalizeMessageKind(kind)];
}

/** Opciones del selector del formulario de envío. */
export const MESSAGE_KIND_OPTIONS: ReadonlyArray<{ value: MessageKind; label: string; desc: string }> = [
  { value: 'notificacion', label: 'Notificación', desc: 'Aviso formal de un hecho o decisión.' },
  { value: 'comunicacion', label: 'Comunicación', desc: 'Mensaje informativo.' },
  { value: 'intimacion', label: 'Intimación', desc: 'Requerimiento con plazo o apercibimiento.' },
];

/** "<Remitente> le envió una notificación." (texto plano, sin HTML). */
export function messageKindSentLine(kind: unknown, sender: string): string {
  return `${sender} le envió una ${messageKindCopy(kind).noun}.`;
}

/** Texto de vista previa de la bandeja de entrada. */
export function messageKindPreviewFallback(kind: unknown, sender: string): string {
  const { noun } = messageKindCopy(kind);
  return `${noun.charAt(0).toUpperCase()}${noun.slice(1)} de ${sender} a través de Notificas.com`;
}

/** Aviso que va al pie del correo, siempre con el mismo texto salvo el sustantivo. */
export function messageDisclaimer(kind: unknown): { lead: string; body: string } {
  const { noun } = messageKindCopy(kind);
  return {
    lead: 'Importante:',
    body:
      ` este correo contiene una ${noun} cuyo contenido se encuentra disponible en el enlace indicado. ` +
      `Recomendamos acceder y leerla a la brevedad. ` +
      `La falta de acceso al enlace no necesariamente impide que la ${noun} produzca los efectos que correspondan. ` +
      `El envío, el acceso y la lectura quedan registrados.`,
  };
}

export function messageDisclaimerText(kind: unknown): string {
  const d = messageDisclaimer(kind);
  return `${d.lead}${d.body}`;
}
