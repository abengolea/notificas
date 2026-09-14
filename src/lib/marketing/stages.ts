export const MARKETING_STAGES = [
  "new",
  "queued",
  "sent",
  "opened",
  "clicked",
  "replied",
  "bounced",
  "unsubscribed",
  "not_interested",
] as const;

export type MarketingStage = (typeof MARKETING_STAGES)[number];

const RANK: Record<MarketingStage, number> = {
  new: 0,
  queued: 1,
  sent: 2,
  opened: 3,
  clicked: 4,
  replied: 5,
  bounced: 80,
  unsubscribed: 90,
  not_interested: 100,
};

export const STAGE_LABEL: Record<MarketingStage, string> = {
  new: "Nuevo",
  queued: "En cola",
  sent: "Enviado",
  opened: "Abierto",
  clicked: "Clic",
  replied: "Respondió",
  bounced: "Rebotó",
  unsubscribed: "Baja",
  not_interested: "No interesa",
};

export const PIPELINE_STAGES: MarketingStage[] = [
  "new",
  "queued",
  "sent",
  "opened",
  "clicked",
  "replied",
];

export function isMarketingStage(value: string): value is MarketingStage {
  return (MARKETING_STAGES as readonly string[]).includes(value);
}

export function stageRank(stage: string | null | undefined): number {
  if (!stage || !isMarketingStage(stage)) return -1;
  return RANK[stage];
}

/** Sube la etapa si el evento es más avanzado. No pisa baja / no interesa / rebote. */
export function nextStage(current: string | null | undefined, incoming: MarketingStage): MarketingStage {
  if (current === "unsubscribed" || current === "not_interested") {
    return current;
  }
  if (incoming === "bounced" || incoming === "unsubscribed" || incoming === "not_interested") {
    return incoming;
  }
  if (!current || !isMarketingStage(current)) return incoming;
  return RANK[incoming] >= RANK[current] ? incoming : current;
}

export function isSendableStage(stage: string | null | undefined): boolean {
  return stage !== "unsubscribed" && stage !== "bounced" && stage !== "not_interested";
}
