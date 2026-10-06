import { audienceForCampaign } from "./audience";
import type { CampaignAudienceSummary } from "./campaign-send-readiness";

function audienceCacheKey(camp: { listId?: unknown; includeStages?: unknown }): string {
  const stages = Array.isArray(camp.includeStages) ? camp.includeStages.map(String) : [];
  return `${String(camp.listId || "")}::${stages.join(",") || "default"}`;
}

export async function attachAudienceSummariesToCampaignRows<T extends Record<string, unknown>>(
  rows: T[],
): Promise<Array<T & { audience: CampaignAudienceSummary | null }>> {
  const cache = new Map<string, CampaignAudienceSummary>();

  for (const row of rows) {
    if (String(row.status || "") !== "draft" || !row.listId) continue;
    const key = audienceCacheKey(row);
    if (cache.has(key)) continue;
    const result = await audienceForCampaign(row);
    cache.set(key, {
      total: result.total,
      eligible: result.eligible,
      skipped: result.skipped,
    });
  }

  return rows.map((row) => {
    const isDraft = String(row.status || "") === "draft";
    const audience =
      isDraft && row.listId ? cache.get(audienceCacheKey(row)) ?? null : null;
    return { ...row, audience };
  });
}
