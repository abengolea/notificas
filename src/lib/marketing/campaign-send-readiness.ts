export type CampaignAudienceSummary = {
  total: number;
  eligible: number;
  skipped: number;
};

export type CampaignSendBlockReason =
  | "not_draft"
  | "archived"
  | "no_list"
  | "no_subject"
  | "no_email_title"
  | "no_audience"
  | "no_eligible";

export type CampaignSendReadinessInput = {
  status: string;
  archivedAt?: string | null;
  listId?: string | null;
  listName?: string | null;
  subject?: string;
  emailTitle?: string;
  audience?: CampaignAudienceSummary | null;
};

export function evaluateCampaignSendReadiness(
  input: CampaignSendReadinessInput,
): { ok: true } | { ok: false; reason: CampaignSendBlockReason } {
  if (input.status !== "draft") return { ok: false, reason: "not_draft" };
  if (input.archivedAt) return { ok: false, reason: "archived" };
  if (!input.listId && !input.listName) return { ok: false, reason: "no_list" };
  if ((input.subject || "").trim().length < 2) return { ok: false, reason: "no_subject" };
  const title = (input.emailTitle || input.subject || "").trim();
  if (title.length < 2) return { ok: false, reason: "no_email_title" };
  const total = input.audience?.total ?? 0;
  const eligible = input.audience?.eligible ?? 0;
  if (total === 0) return { ok: false, reason: "no_audience" };
  if (eligible === 0) return { ok: false, reason: "no_eligible" };
  return { ok: true };
}

export function canSendMarketingCampaign(input: CampaignSendReadinessInput): boolean {
  return evaluateCampaignSendReadiness(input).ok;
}

export function campaignAudienceStatusLabel(
  readiness: ReturnType<typeof evaluateCampaignSendReadiness>,
  audience?: CampaignAudienceSummary | null,
): string | null {
  if (readiness.ok) return null;
  switch (readiness.reason) {
    case "no_list":
    case "no_subject":
    case "no_email_title":
      return "Pendiente de completar";
    case "no_audience":
      return "Sin audiencia";
    case "no_eligible":
      return audience && audience.skipped > 0 ? "Sin destinatarios elegibles" : "Sin audiencia";
    default:
      return null;
  }
}
