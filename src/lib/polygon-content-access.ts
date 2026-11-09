import { isPolygonTxHash } from './polygon-send-logic';

/**
 * El acceso al contenido se ancla UNA vez por canal: una transacción cuando el destinatario entra por el enlace de
 * WhatsApp y otra cuando entra por el del correo. Así, quien abre primero por un canal no tapa el acceso por el otro.
 *
 * `contentAccess` es el campo histórico (un solo acceso, el primero, sin importar el canal). Se conserva para los
 * mensajes que ya lo tienen y para los accesos cuyo canal no se puede determinar.
 */
export type ContentAccessChannel = 'email' | 'whatsapp';

export const CONTENT_ACCESS_LEGACY_FIELD = 'contentAccess';

export const CONTENT_ACCESS_CHANNEL_FIELDS: Record<ContentAccessChannel, string> = {
  email: 'contentAccessEmail',
  whatsapp: 'contentAccessWhatsapp',
};

/** Acepta los nombres que circulan en el sistema (`correo`, `email`, `whatsapp`); cualquier otro valor no es un canal. */
export function contentAccessChannel(raw: unknown): ContentAccessChannel | null {
  const v = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  if (v === 'whatsapp') return 'whatsapp';
  if (v === 'email' || v === 'correo') return 'email';
  return null;
}

/** Campo de `polygonCertifications` donde se guarda la TX de ese acceso. Sin canal conocido, el campo histórico. */
export function contentAccessField(channel: ContentAccessChannel | null): string {
  return channel ? CONTENT_ACCESS_CHANNEL_FIELDS[channel] : CONTENT_ACCESS_LEGACY_FIELD;
}

/**
 * TX que ya cubre este acceso, o null si todavía hay que anclarlo.
 * - Con canal: la TX de ese canal, o la histórica si su vía era justo ese canal.
 * - Sin canal: cualquier acceso ya anclado cubre este (no se agrega una TX por una vía que no distingue canal).
 */
export function existingContentAccessTx(
  certs: Record<string, unknown> | null | undefined,
  channel: ContentAccessChannel | null
): string | null {
  const c = certs || {};
  const own = channel ? c[CONTENT_ACCESS_CHANNEL_FIELDS[channel]] : null;
  if (isPolygonTxHash(own)) return own;

  const legacy = c[CONTENT_ACCESS_LEGACY_FIELD];
  if (isPolygonTxHash(legacy)) {
    if (!channel) return legacy;
    if (contentAccessChannel(c.contentAccessVia) === channel) return legacy;
  }

  if (!channel) {
    for (const field of Object.values(CONTENT_ACCESS_CHANNEL_FIELDS)) {
      if (isPolygonTxHash(c[field])) return c[field] as string;
    }
  }
  return null;
}

/** Texto de `via:` que viaja en la TX: deja escrito el canal aunque el acceso haya sido por el lector o un adjunto. */
export function contentAccessPayloadVia(
  via: string | undefined,
  channel: ContentAccessChannel | null
): string | undefined {
  if (!channel) return via;
  if (!via || contentAccessChannel(via) === channel) return channel;
  return `${channel}/${via}`;
}
