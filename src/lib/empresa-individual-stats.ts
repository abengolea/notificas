export type IndividualSendStatus = "Leído" | "Abierto" | "Rebotó" | "Aceptado por SMTP" | "Pendiente";

export type IndividualSendSummary = {
  id: string;
  sentAt: Date | null;
  to: string;
  subject: string;
  lastStatus: IndividualSendStatus;
};

export function isCampaignMailDoc(data: Record<string, unknown>): boolean {
  return Boolean(data.campaignId || data.campaignMessageId);
}

export function mailBelongsToOrg(data: Record<string, unknown>, orgId: string): boolean {
  const tagged = typeof data.orgId === "string" ? data.orgId : "";
  return !tagged || tagged === orgId;
}

function asDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "string") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === "object") {
    const o = value as { toDate?: () => Date; seconds?: number; _seconds?: number };
    if (typeof o.toDate === "function") {
      const d = o.toDate();
      return d instanceof Date && !Number.isNaN(d.getTime()) ? d : null;
    }
    const secs = o.seconds ?? o._seconds;
    if (typeof secs === "number") return new Date(secs * 1000);
  }
  return null;
}

export function individualMailSentAt(data: Record<string, unknown>): Date | null {
  const delivery = data.delivery as { time?: unknown } | undefined;
  const tracking = data.tracking as { sentAt?: unknown } | undefined;
  return asDate(delivery?.time) ?? asDate(tracking?.sentAt) ?? asDate(data.createdAt);
}

export function individualMailStatus(data: Record<string, unknown>): IndividualSendStatus {
  const movements = (data.tracking as { movements?: unknown[] } | undefined)?.movements || [];
  const types = movements.map((m) => (m && typeof m === "object" ? (m as { type?: string; viewerIsSender?: boolean }) : {}));
  if (types.some((m) => m.type === "read_confirmed")) return "Leído";
  if (types.some((m) => m.type === "email_opened" || (m.type === "app_opened" && !m.viewerIsSender))) return "Abierto";
  if (data.emailBounce) return "Rebotó";
  if (types.some((m) => m.type === "email_sent")) return "Aceptado por SMTP";
  return "Pendiente";
}

export function mapMailToIndividualSend(id: string, data: Record<string, unknown>): IndividualSendSummary {
  const rawTo = data.to;
  const toList = Array.isArray(rawTo) ? rawTo.map(String) : rawTo ? [String(rawTo)] : [];
  const recipient = typeof data.recipientEmail === "string" ? data.recipientEmail : toList[0] || "";
  const subject = (data.message as { subject?: string } | undefined)?.subject?.trim() || "Sin asunto";
  return {
    id,
    sentAt: individualMailSentAt(data),
    to: recipient,
    subject,
    lastStatus: individualMailStatus(data),
  };
}

export function buildIndividualDashboardStats(rows: IndividualSendSummary[], now = new Date()) {
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  let esteMes = 0;
  let leidos = 0;
  let abiertos = 0;
  let rebotes = 0;
  let pendientes = 0;

  for (const row of rows) {
    if (row.sentAt && row.sentAt >= startOfMonth) esteMes += 1;
    if (row.lastStatus === "Leído") leidos += 1;
    else if (row.lastStatus === "Abierto") abiertos += 1;
    else if (row.lastStatus === "Rebotó") rebotes += 1;
    else if (row.lastStatus === "Pendiente") pendientes += 1;
  }

  const recientes = [...rows]
    .sort((a, b) => (b.sentAt?.getTime() ?? 0) - (a.sentAt?.getTime() ?? 0))
    .slice(0, 8);

  return { total: rows.length, esteMes, leidos, abiertos, rebotes, pendientes, recientes };
}
