/** Pausa entre un WhatsApp de campaña y el siguiente (Meta). Default: 1 cada 2 s. */
export const DEFAULT_CAMPAIGN_SEND_GAP_MS = 2_000;

export function campaignSendGapMs(): number {
  const raw = Number(process.env.CAMPAIGN_SEND_GAP_MS);
  if (Number.isFinite(raw) && raw >= 0) return Math.min(raw, 60_000);
  return DEFAULT_CAMPAIGN_SEND_GAP_MS;
}

export function waitCampaignSendGap(): Promise<void> {
  const ms = campaignSendGapMs();
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}
