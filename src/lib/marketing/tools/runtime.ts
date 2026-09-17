import { createFirestoreMarketingRepositories } from "../repositories/firestore";
import { createMemoryMarketingRepositories } from "../repositories/memory";
import { createMarketingServices } from "../services";
import { createLiveCampaignCatalog } from "./catalog-live";
import { createMemoryCampaignCatalog } from "./catalog-memory";
import { createLiveIdempotencyStore, createMemoryIdempotencyStore } from "./idempotency";
import { createLiveCrmStats, createMemoryCrmStats } from "./stats";
import type { CampaignListCatalog, CrmStatsPort, CrmToolRuntime, IdempotencyStore } from "./types";
import type { MarketingRepositories } from "../repositories/types";
import type { MarketingServices } from "../services";

export function createCrmToolRuntime(opts: {
  services: MarketingServices;
  catalog: CampaignListCatalog;
  stats: CrmStatsPort;
  idempotency: IdempotencyStore;
}): CrmToolRuntime {
  return opts;
}

export function createMemoryCrmToolRuntime(repos?: MarketingRepositories): {
  runtime: CrmToolRuntime;
  repos: MarketingRepositories;
} {
  const memory = repos || createMemoryMarketingRepositories();
  return {
    repos: memory,
    runtime: createCrmToolRuntime({
      services: createMarketingServices(memory),
      catalog: createMemoryCampaignCatalog(),
      stats: createMemoryCrmStats(memory),
      idempotency: createMemoryIdempotencyStore(),
    }),
  };
}

let liveRuntime: CrmToolRuntime | null = null;

export function getLiveCrmToolRuntime(): CrmToolRuntime {
  if (!liveRuntime) {
    const repos = createFirestoreMarketingRepositories();
    liveRuntime = createCrmToolRuntime({
      services: createMarketingServices(repos),
      catalog: createLiveCampaignCatalog(),
      stats: createLiveCrmStats(),
      idempotency: createLiveIdempotencyStore(),
    });
  }
  return liveRuntime;
}
