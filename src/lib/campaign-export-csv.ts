import { isSyntheticCampaignEmail } from '@/lib/parse-campaign-csv';
import { isRealSmtpMessageId } from '@/lib/email-delivery-label';
import type { CanalCampaign } from '@/lib/types';

/**
 * Qué protege cada hash del CSV (ninguno es redundante):
 * - Hash contenido: SHA-256 del texto intimado (cuerpo de campaña; en WA-only el globo renderizado).
 * - Hash aviso WhatsApp: SHA-256 canónico del pedido a Meta (waBodyHash / waRequestSnapshot).
 * - Hash snapshot: huella del expediente lacrado (evidence_snapshots).
 * - Merkle root: raíz del lote de envío anclado en Polygon (hasta 500 destinatarios).
 */

export const CAMPAIGN_EXPORT_HEADERS = [
  'N°',
  'Campaign ID',
  'Nombre campaña',
  'Notification ID',
  'Remitente',
  'CUIT remitente',
  'Nombre',
  'DNI',
  'Legajo',
  'Teléfono',
  'Email',
  'Canal',
  'Fecha vencimiento',
  'Monto',
  'Cuotas',
  'Días de mora',
  'Template Meta',
  'Template ID Meta',
  'Idioma template',
  'Template Hash',
  'WAMID (WhatsApp)',
  'SMTP Message-ID',
  'Estado canal',
  'Estado proveedor',
  'Enviado (UTC)',
  'Entregado (UTC)',
  'Leído (UTC)',
  'Click enlace (UTC)',
  'Código error',
  'Detalle error',
  'Hash contenido',
  'Hash aviso WhatsApp',
  'Hash snapshot',
  'Merkle root',
  'TX Polygon — envío',
  'TX Polygon — entrega',
  'TX Polygon — lectura',
  'Verificar en Polygonscan',
  'Verificar en Notificas',
] as const;

export type CampaignExportContext = {
  campaignId: string;
  campaignNombre: string;
  remitente: string;
  cuitRemitente: string;
  canal: CanalCampaign | string;
  appBase: string;
};

type Movement = {
  type?: string;
  timestamp?: unknown;
};

function str(v: unknown): string {
  if (v == null) return '';
  return String(v).trim();
}

export function formatExportTs(v: unknown): string {
  if (v == null || v === '') return '';
  if (typeof v === 'object' && v && 'toDate' in v && typeof (v as { toDate: () => Date }).toDate === 'function') {
    try {
      return (v as { toDate: () => Date }).toDate().toISOString();
    } catch {
      return '';
    }
  }
  if (typeof v === 'object' && v && ('_seconds' in v || 'seconds' in v)) {
    const secs = Number((v as { _seconds?: number; seconds?: number })._seconds ?? (v as { seconds?: number }).seconds);
    if (Number.isFinite(secs)) return new Date(secs * 1000).toISOString();
  }
  if (typeof v === 'number' && Number.isFinite(v)) {
    const ms = v < 1e12 ? v * 1000 : v;
    return new Date(ms).toISOString();
  }
  try {
    const d = new Date(v as string);
    return Number.isNaN(d.getTime()) ? '' : d.toISOString();
  } catch {
    return '';
  }
}

export function csvEscape(v: unknown): string {
  const s = v == null ? '' : String(v);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function csvRow(fields: unknown[]): string {
  return fields.map(csvEscape).join(',');
}

export function canalExportLabel(canal: unknown): string {
  switch (String(canal || '')) {
    case 'whatsapp':
      return 'WhatsApp';
    case 'email':
      return 'Email';
    case 'ambos':
      return 'WhatsApp + Email';
    default:
      return '';
  }
}

export function publicRecipientEmail(raw: unknown): string {
  const email = str(raw);
  if (!email || isSyntheticCampaignEmail(email)) return '';
  return email;
}

export function publicSmtpMessageId(raw: unknown): string {
  return isRealSmtpMessageId(raw) ? str(raw) : '';
}

export function splitExportError(raw: unknown): { code: string; detail: string } {
  const detail = str(raw);
  if (!detail) return { code: '', detail: '' };
  const hash = detail.match(/#(\d{4,})/);
  if (hash) return { code: hash[1], detail };
  const lead = detail.match(/^(\d{4,})\b/);
  if (lead) return { code: lead[1], detail };
  return { code: '', detail };
}

function isTx(v: unknown): string {
  const s = str(v);
  return /^0x[0-9a-fA-F]{16,}$/.test(s) ? s : '';
}

function rec(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
}

function nested(obj: Record<string, unknown>, path: string[]): unknown {
  let cur: unknown = obj;
  for (const key of path) {
    if (!cur || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur;
}

function movementsOf(mail: Record<string, unknown>): Movement[] {
  const tracking = rec(mail.tracking);
  return Array.isArray(tracking.movements) ? (tracking.movements as Movement[]) : [];
}

function movementByType(mail: Record<string, unknown>, type: string): Movement | undefined {
  return movementsOf(mail).find((mv) => mv.type === type);
}

function firstTs(...vals: unknown[]): string {
  for (const v of vals) {
    const t = formatExportTs(v);
    if (t) return t;
  }
  return '';
}

function waSnapshot(mail: Record<string, unknown>): Record<string, unknown> {
  return rec(mail.waRequestSnapshot);
}

export function canalLifecycleEstado(m: Record<string, unknown>, canal: unknown): string {
  const wa = str(m.waEstado);
  const email = str(m.emailEstado);
  const unified = str(m.estado);
  const ch = String(canal || '');
  if (ch === 'whatsapp') {
    if (wa === 'leido') return 'read';
    if (wa === 'entregado') return 'delivered';
    if (wa === 'enviado') return 'sent';
    if (wa === 'error') return 'failed';
    if (wa === 'pendiente') return 'pending';
  }
  if (ch === 'email') {
    if (email === 'leido' || unified === 'leido') return 'opened';
    if (email === 'enviado' || unified === 'enviado') return 'sent';
    if (email === 'error' || unified === 'error') return 'failed';
    if (email === 'pendiente' || unified === 'pendiente') return 'pending';
  }
  if (unified === 'error' || wa === 'error' || email === 'error') return 'failed';
  if (unified === 'leido' || wa === 'leido' || email === 'leido') return wa === 'leido' ? 'read' : 'opened';
  if (wa === 'entregado') return 'delivered';
  if (unified === 'enviado' || wa === 'enviado' || email === 'enviado') return 'sent';
  if (unified === 'pendiente') return 'pending';
  return unified;
}

export function proveedorEstado(mail: Record<string, unknown>, m: Record<string, unknown>): string {
  const tracking = rec(mail.tracking);
  if (mail.bounce || tracking.bounced) return 'bounced';
  if (movementByType(mail, 'whatsapp_read') || tracking.whatsappRead === true || str(m.waEstado) === 'leido') {
    return 'read';
  }
  if (movementByType(mail, 'whatsapp_delivered') || tracking.whatsappDelivered === true || str(m.waEstado) === 'entregado') {
    return 'delivered';
  }
  if (movementByType(mail, 'whatsapp_failed') || str(m.waEstado) === 'error') return 'failed';
  if (movementByType(mail, 'whatsapp_sent') || str(m.waEstado) === 'enviado') return 'sent';
  const delivery = rec(mail.delivery);
  const state = str(delivery.state).toUpperCase();
  if (state === 'ERROR') return 'failed';
  if (emailOpened(mail, m)) return 'opened';
  if (state === 'DELIVERED' || state === 'SUCCESS') return 'sent';
  return '';
}

function emailOpened(mail: Record<string, unknown>, m: Record<string, unknown>): boolean {
  if (str(m.emailEstado) === 'leido') return true;
  return movementsOf(mail).some((mv) => {
    const t = str(mv.type);
    return t === 'email_read' || t === 'opened' || t === 'app_open' || t === 'reader_open';
  });
}

export function buildCampaignExportFields(
  rowNum: number,
  messageId: string,
  m: Record<string, unknown>,
  mail: Record<string, unknown>,
  ctx: CampaignExportContext
): unknown[] {
  const mailId = str(m.mailId);
  const snap = waSnapshot(mail);
  const tracking = rec(mail.tracking);
  const integrity = rec(m.integrity);
  const send = rec(integrity.send);
  const events = rec(integrity.events);
  const poly = rec(mail.polygonCertifications);
  const delivery = rec(mail.delivery);
  const err = splitExportError(m.errorMsg || m.waError || delivery.error);

  const txEnvio = isTx(send.txHash) || isTx(poly.send) || isTx(m.txHashEnvio) || isTx(m.emailTxEnvio);
  const txEntrega =
    isTx(m.waTxEntregado) ||
    isTx(nested(events, ['wa_delivered', 'txHash'])) ||
    isTx(poly.waDelivered);
  const txLectura =
    isTx(m.waTxLeido) ||
    isTx(nested(events, ['wa_read', 'txHash'])) ||
    isTx(poly.waRead) ||
    isTx(m.emailTxLectura) ||
    isTx(poly.read) ||
    isTx(m.txHashLectura);

  const verifyTx = txEnvio || txEntrega || txLectura;
  const polygonscanUrl = verifyTx ? `https://polygonscan.com/tx/${verifyTx}` : '';
  const verifyId = mailId || messageId;
  const verifyUrl = `${ctx.appBase}/verify?id=${encodeURIComponent(verifyId)}`;

  const enviado = firstTs(m.waEnviadoAt, m.enviadoAt, m.emailEnviadoAt);
  const entregado = firstTs(
    m.waEntregadoAt,
    tracking.whatsappDeliveredAt,
    movementByType(mail, 'whatsapp_delivered')?.timestamp
  );
  const leido = firstTs(m.waLeidoAt, tracking.whatsappReadAt, m.leidoAt, m.emailLeidoAt);
  const click = firstTs(m.waClickAt, m.emailClickAt);

  return [
    rowNum,
    ctx.campaignId,
    ctx.campaignNombre,
    messageId,
    ctx.remitente,
    ctx.cuitRemitente,
    str(m.recipientNombre),
    str(m.recipientDni || mail.recipientDni),
    str(m.recipientLegajo || mail.recipientLegajo),
    str(mail.recipientPhone || m.recipientTelefono),
    publicRecipientEmail(m.recipientEmail || mail.recipientEmail),
    canalExportLabel(ctx.canal),
    str(m.recipientFecha || mail.recipientFecha),
    str(m.recipientMonto || mail.recipientMonto),
    str(m.recipientCuotas || mail.recipientCuotas),
    str(m.recipientDias || mail.recipientDias),
    str(snap.templateName || mail.waTemplateName || ''),
    str(snap.templateId),
    str(snap.templateLang || mail.waTemplateLang),
    str(snap.templateHash),
    str(mail.whatsappMessageId || tracking.whatsappMessageId),
    publicSmtpMessageId(mail.smtpMessageId),
    canalLifecycleEstado(m, ctx.canal),
    proveedorEstado(mail, m),
    enviado,
    entregado,
    leido,
    click,
    err.code,
    err.detail,
    str(send.contentHash || poly.contentHash),
    str(send.waBodyHash || poly.waBodyHash),
    str(mail.evidenceSnapshotHash),
    str(send.merkleRoot),
    txEnvio,
    txEntrega,
    txLectura,
    polygonscanUrl,
    verifyUrl,
  ];
}
