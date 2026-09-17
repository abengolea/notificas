import type { MarketingActorType } from "./domain/types";

/**
 * Contexto de un caller de servicios CRM.
 * El workspace lo fija la capa de entrada (API/MCP/job), nunca el body del cliente.
 */
export type MarketingServiceContext = {
  workspaceId: string;
  actorType: MarketingActorType;
  actorId?: string;
  /** Reservado. Ignorado en etapa 2. */
  idempotencyKey?: string;
};

export type MarketingActorContext = Pick<
  MarketingServiceContext,
  "workspaceId" | "actorType" | "actorId"
>;

export function marketingContext(
  workspaceId: string,
  actor?: { actorType?: MarketingActorType; actorId?: string; idempotencyKey?: string },
): MarketingServiceContext {
  return {
    workspaceId,
    actorType: actor?.actorType || "system",
    actorId: actor?.actorId,
    idempotencyKey: actor?.idempotencyKey,
  };
}
