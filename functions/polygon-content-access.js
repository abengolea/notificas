'use strict';

/**
 * Espejo mínimo de src/lib/polygon-content-access.ts (las Functions son otro paquete y no importan de src).
 * El acceso al contenido se ancla una vez por canal (WhatsApp / correo); `contentAccess` es el campo histórico.
 * Si cambia una regla acá, cambiarla también allá.
 */
const CHANNEL_FIELDS = { email: 'contentAccessEmail', whatsapp: 'contentAccessWhatsapp' };
const LEGACY_FIELD = 'contentAccess';

function isTxHash(v) {
  return typeof v === 'string' && /^0x[0-9a-fA-F]{64}$/.test(v);
}

function contentAccessChannel(raw) {
  const v = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  if (v === 'whatsapp') return 'whatsapp';
  if (v === 'email' || v === 'correo') return 'email';
  return null;
}

/** ¿Ya hay una TX que cubre este acceso? (mismas reglas que existingContentAccessTx del lado web) */
function contentAccessAlreadyCertified(certs, channel) {
  const c = certs || {};
  if (channel && isTxHash(c[CHANNEL_FIELDS[channel]])) return true;
  if (isTxHash(c[LEGACY_FIELD])) {
    if (!channel) return true;
    if (contentAccessChannel(c.contentAccessVia) === channel) return true;
  }
  if (!channel) return Object.values(CHANNEL_FIELDS).some((f) => isTxHash(c[f]));
  return false;
}

module.exports = { contentAccessChannel, contentAccessAlreadyCertified };
