import { pipeSafe } from './campaign-source-canonical';

/** Hojas nuevas: v2 incluye DNI/monto/nombre/rowHash. Las v1 se verifican con el leafPayload guardado. */
export function buildSendLeafPayload(input: {
  campaignId: string;
  messageId: string;
  email: string;
  phone: string;
  contentHash: string;
  attachmentHashes: string[];
  smtpMessageId: string;
  wamid: string;
  waBodyHash?: string;
  templateSealHash?: string;
  dni?: string;
  nombre?: string;
  monto?: string;
  cuotas?: string;
  rowHash?: string;
}): string {
  const att = [...input.attachmentHashes].filter(Boolean).sort().join(',');
  return [
    'v2',
    'send',
    input.campaignId,
    input.messageId,
    pipeSafe(input.email).toLowerCase(),
    pipeSafe(input.phone).replace(/\D/g, ''),
    pipeSafe(input.dni).replace(/\D/g, ''),
    pipeSafe(input.nombre),
    pipeSafe(input.monto),
    pipeSafe(input.cuotas),
    pipeSafe(input.rowHash),
    input.contentHash,
    att,
    input.smtpMessageId || '',
    input.wamid || '',
    input.waBodyHash || '',
    input.templateSealHash || '',
  ].join('|');
}

export function parseSendLeafPayload(payload: string | undefined): {
  version: string;
  email: string;
  phone: string;
  dni: string;
  nombre: string;
  monto: string;
  cuotas: string;
  rowHash: string;
  contentHash: string;
  wamid: string;
} | null {
  if (!payload) return null;
  const p = payload.split('|');
  if (p[0] === 'v2' && p[1] === 'send' && p.length >= 17) {
    return {
      version: 'v2',
      email: p[4] || '',
      phone: p[5] || '',
      dni: p[6] || '',
      nombre: p[7] || '',
      monto: p[8] || '',
      cuotas: p[9] || '',
      rowHash: p[10] || '',
      contentHash: p[11] || '',
      wamid: p[14] || '',
    };
  }
  if (p[0] === 'v1' && p[1] === 'send' && p.length >= 10) {
    return {
      version: 'v1',
      email: p[4] || '',
      phone: p[5] || '',
      dni: '',
      nombre: '',
      monto: '',
      cuotas: '',
      rowHash: '',
      contentHash: p[6] || '',
      wamid: p[9] || '',
    };
  }
  return null;
}

export type EventLeafMetaEvidence = {
  wamid?: string;
  status?: string;
  metaTimestamp?: string;
  recipientId?: string;
  rawPayloadHash?: string;
};

export type IntegrityEventTypeLeaf = 'email_read' | 'wa_delivered' | 'wa_read';

export function buildEventLeafPayload(input: {
  campaignId: string;
  messageId: string;
  eventType: IntegrityEventTypeLeaf;
  occurredAt: string;
  sendLeafHash: string;
  meta?: EventLeafMetaEvidence;
}): string {
  const v1 = [
    'v1',
    'event',
    input.campaignId,
    input.messageId,
    input.eventType,
    input.occurredAt,
    input.sendLeafHash || '',
  ];
  const hash = input.meta?.rawPayloadHash?.trim();
  if (!hash) return v1.join('|');
  return [
    'v2',
    'event',
    input.campaignId,
    input.messageId,
    input.eventType,
    input.occurredAt,
    input.sendLeafHash || '',
    input.meta?.wamid || '',
    input.meta?.status || '',
    input.meta?.metaTimestamp || '',
    input.meta?.recipientId || '',
    hash,
  ].join('|');
}

export function parseEventLeafPayload(payload: string | undefined): {
  version: string;
  eventType: string;
  occurredAt: string;
  sendLeafHash: string;
  wamid?: string;
  rawPayloadHash?: string;
} | null {
  if (!payload) return null;
  const p = payload.split('|');
  if (p[1] !== 'event') return null;
  if (p[0] === 'v2' && p.length >= 12) {
    return {
      version: 'v2',
      eventType: p[4] || '',
      occurredAt: p[5] || '',
      sendLeafHash: p[6] || '',
      wamid: p[7] || '',
      rawPayloadHash: p[11] || '',
    };
  }
  if (p[0] === 'v1' && p.length >= 7) {
    return {
      version: 'v1',
      eventType: p[4] || '',
      occurredAt: p[5] || '',
      sendLeafHash: p[6] || '',
    };
  }
  return null;
}

