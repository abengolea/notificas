export const PUBLIC_NOTIFICATION_STATUSES = [
  "queued",
  "processing",
  "sent",
  "delivered",
  "read",
  "failed",
] as const;

export type PublicNotificationStatus = (typeof PUBLIC_NOTIFICATION_STATUSES)[number];

export const PUBLIC_CERTIFICATE_STATUSES = ["processing", "ready", "sandbox", "unavailable"] as const;
export type PublicCertificateStatus = (typeof PUBLIC_CERTIFICATE_STATUSES)[number];

export const PUBLIC_BATCH_STATUSES = ["queued", "processing", "completed", "paused", "cancelled", "failed"] as const;
export type PublicBatchStatus = (typeof PUBLIC_BATCH_STATUSES)[number];

const RANK: Record<PublicNotificationStatus, number> = {
  queued: 0,
  processing: 1,
  sent: 2,
  delivered: 3,
  read: 4,
  failed: 5,
};

export function statusRank(status: PublicNotificationStatus): number {
  return RANK[status] ?? 0;
}

/** Un failed no debe pisar un delivered/read ya registrado, salvo que el canal informe fallo real de envío. */
export function mergeStatus(
  current: PublicNotificationStatus | undefined,
  incoming: PublicNotificationStatus
): PublicNotificationStatus {
  if (!current) return incoming;
  if (incoming === "failed") {
    if (current === "delivered" || current === "read") return current;
    return "failed";
  }
  if (current === "failed") return incoming;
  return statusRank(incoming) >= statusRank(current) ? incoming : current;
}

function str(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

/**
 * Capa de normalización sobre los estados reales de `mail` / `campaign_messages`.
 * No inventa hechos: "sent" = aceptado por el proveedor; "delivered"/"read" = lo que
 * reportó Meta o el transporte de correo / apertura del lector.
 */
export function normalizeNotificationStatus(input: {
  deliveryState?: unknown;
  transportStatus?: unknown;
  whatsappDelivered?: unknown;
  whatsappRead?: unknown;
  readConfirmed?: unknown;
  readerOpened?: unknown;
  campaignEstado?: unknown;
  waEstado?: unknown;
  emailEstado?: unknown;
  simulated?: unknown;
  queued?: boolean;
}): PublicNotificationStatus {
  const delivery = str(input.deliveryState).toUpperCase();
  const transport = str(input.transportStatus).toLowerCase();
  const camp = str(input.campaignEstado).toLowerCase();
  const wa = str(input.waEstado).toLowerCase();
  const email = str(input.emailEstado).toLowerCase();

  if (
    delivery === "ERROR" ||
    camp === "error" ||
    wa === "error" ||
    email === "error" ||
    transport === "bounced" ||
    transport === "failed" ||
    transport === "suppressed"
  ) {
    return "failed";
  }

  if (
    input.whatsappRead === true ||
    input.readConfirmed === true ||
    wa === "leido" ||
    email === "leido" ||
    camp === "leido"
  ) {
    return "read";
  }

  if (input.whatsappDelivered === true || wa === "entregado" || transport === "delivered") {
    return "delivered";
  }

  if (
    delivery === "DELIVERED" ||
    camp === "enviado" ||
    wa === "enviado" ||
    email === "enviado" ||
    transport === "sent"
  ) {
    return "sent";
  }

  if (input.queued === false && (delivery || camp === "enviando")) return "processing";
  return "queued";
}

export function normalizeBatchStatus(estado: unknown): PublicBatchStatus {
  switch (String(estado || "").toLowerCase()) {
    case "enviando":
      return "processing";
    case "completada":
      return "completed";
    case "pausada":
      return "paused";
    case "cancelada":
      return "cancelled";
    case "borrador":
      return "queued";
    default:
      return "queued";
  }
}

export function certificateStatusFromMail(input: {
  evidenceSealed?: unknown;
  evidenceSnapshotHash?: unknown;
  constanciaPath?: unknown;
  testMode?: boolean;
  simulated?: boolean;
  realSend?: boolean;
}): PublicCertificateStatus {
  if (input.testMode && !input.realSend) return "sandbox";
  if (input.evidenceSealed === true || str(input.evidenceSnapshotHash) || str(input.constanciaPath)) {
    return "ready";
  }
  return "processing";
}
