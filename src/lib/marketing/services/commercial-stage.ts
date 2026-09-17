import {
  commercialStageSeedForWorkspace,
  isMarketingCommercialStageId,
  type MarketingCommercialStageId,
} from "../domain/commercial-stages";
import { MarketingValidationError } from "../errors";
import { isMarketingStage } from "../stages";
import type { MarketingServiceContext } from "../context";

export function createCommercialStageService() {
  return {
    listCommercialStages(ctx: MarketingServiceContext) {
      return commercialStageSeedForWorkspace(ctx.workspaceId);
    },
    getCommercialStage(ctx: MarketingServiceContext, id: string) {
      return this.listCommercialStages(ctx).find((s) => s.id === id) || null;
    },
    validateCommercialStage(id: string): MarketingCommercialStageId {
      if (isMarketingStage(id)) {
        throw new MarketingValidationError("Esa etapa es de engagement de email, no del pipeline comercial");
      }
      if (!isMarketingCommercialStageId(id)) {
        throw new MarketingValidationError(`commercialStageId desconocido: ${id}`);
      }
      return id;
    },
  };
}

export type CommercialStageService = ReturnType<typeof createCommercialStageService>;
