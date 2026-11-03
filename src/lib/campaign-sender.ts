function asEmail(raw: string | null | undefined): string {
  const s = String(raw || "").trim().toLowerCase();
  return s.includes("@") ? s : "";
}

/**
 * Reply-to / casilla de la empresa.
 * En campañas armadas desde Admin, nunca el Gmail del operador de Notificas.
 */
export function resolveCampaignSenderEmail(input: {
  managedByAdmin?: boolean;
  campaignSenderEmail?: string | null;
  orgAdminEmail?: string | null;
  actorEmail?: string | null;
}): string {
  const campaign = asEmail(input.campaignSenderEmail);
  const org = asEmail(input.orgAdminEmail);
  const actor = asEmail(input.actorEmail);
  if (input.managedByAdmin) return org || campaign;
  return campaign || actor || org;
}

/** Nombre visible en el sobre (“Enviada por …”). El destinatario no ve el mail. */
export function resolveCampaignSenderDisplay(input: {
  orgNombre?: string | null;
  fallbackEmail?: string | null;
}): string {
  const name = String(input.orgNombre || "").trim();
  if (name) return name;
  return asEmail(input.fallbackEmail);
}
