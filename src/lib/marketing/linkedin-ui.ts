import type {
  MarketingLinkedInAction,
  MarketingLinkedInCampaignStatus,
  MarketingLinkedInMemberStatus,
  MarketingLinkedInMessageType,
} from "./domain/types";

export const LINKEDIN_CAMPAIGN_STATUS_LABEL: Record<MarketingLinkedInCampaignStatus, string> = {
  draft: "Borrador",
  active: "Activa",
  paused: "Pausada",
  completed: "Completada",
  archived: "Archivada",
};

export const LINKEDIN_MEMBER_STATUS_LABEL: Record<MarketingLinkedInMemberStatus, string> = {
  not_contacted: "Sin contactar",
  connection_ready: "Conexión preparada",
  connection_sent: "Conexión enviada",
  connected: "Conectado",
  message_ready: "Mensaje preparado",
  message_sent: "Mensaje enviado",
  follow_up_due: "Seguimiento pendiente",
  follow_up_sent: "Seguimiento enviado",
  replied: "Respondió",
  interested: "Interesado",
  not_interested: "No interesado",
  do_not_contact: "No contactar",
};

export const LINKEDIN_MESSAGE_TYPE_LABEL: Record<MarketingLinkedInMessageType, string> = {
  connection_request: "Solicitud de conexión",
  direct_message: "Mensaje directo",
  multistep: "Conexión + mensaje + seguimiento",
};

export const LINKEDIN_ACTION_LABEL: Record<MarketingLinkedInAction, string> = {
  connection_sent: "Registrar conexión enviada",
  connected: "Registrar conexión aceptada",
  message_sent: "Registrar mensaje enviado",
  followup_sent: "Registrar seguimiento enviado",
  replied: "Registrar respuesta",
  interested: "Marcar interesado",
  not_interested: "Marcar no interesado",
};

export function toLocalDateTime(iso?: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export function toIsoDateTime(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function latestLinkedInActionAt(member: {
  connectionSentAt?: string | null;
  connectedAt?: string | null;
  messageSentAt?: string | null;
  followUpSentAt?: string | null;
  repliedAt?: string | null;
  interestedAt?: string | null;
  notInterestedAt?: string | null;
}): string | null {
  const dates = [
    member.connectionSentAt,
    member.connectedAt,
    member.messageSentAt,
    member.followUpSentAt,
    member.repliedAt,
    member.interestedAt,
    member.notInterestedAt,
  ].filter((value): value is string => Boolean(value));
  dates.sort();
  return dates.length ? dates[dates.length - 1] : null;
}
