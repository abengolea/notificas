import { DEFAULT_MARKETING_WORKSPACE_ID } from "../workspace";
import type { MarketingCommercialStage } from "./types";

/**
 * Catálogo inicial de pipeline comercial. IDs distintos de `MarketingStage` (email).
 * No hardcodear en componentes: importar desde aquí o leer Firestore más adelante.
 */
export const MARKETING_COMMERCIAL_STAGE_SEED: ReadonlyArray<
  Omit<MarketingCommercialStage, "workspaceId"> & { workspaceId?: string }
> = [
  { id: "nuevo", name: "Nuevo", order: 10, active: true },
  { id: "para_investigar", name: "Para investigar", order: 20, active: true },
  { id: "listo_para_contactar", name: "Listo para contactar", order: 30, active: true },
  { id: "contactado", name: "Contactado", order: 40, active: true },
  { id: "seguimiento_pendiente", name: "Seguimiento pendiente", order: 50, active: true },
  { id: "respondio", name: "Respondió", order: 60, active: true },
  { id: "interesado", name: "Interesado", order: 70, active: true },
  { id: "reunion_agendada", name: "Reunión agendada", order: 80, active: true },
  { id: "demo_realizada", name: "Demo realizada", order: 90, active: true },
  { id: "piloto", name: "Piloto", order: 100, active: true },
  { id: "negociacion", name: "Negociación", order: 110, active: true },
  { id: "cliente", name: "Cliente", order: 120, active: true, isWon: true },
  { id: "pausado", name: "Pausado", order: 130, active: true },
  { id: "no_interesado", name: "No interesado", order: 140, active: true, isLost: true },
  { id: "perdido", name: "Perdido", order: 150, active: true, isLost: true },
] as const;

export type MarketingCommercialStageId = (typeof MARKETING_COMMERCIAL_STAGE_SEED)[number]["id"];

export function isMarketingCommercialStageId(value: string): value is MarketingCommercialStageId {
  return MARKETING_COMMERCIAL_STAGE_SEED.some((s) => s.id === value);
}

export function commercialStageSeedForWorkspace(
  workspaceId: string = DEFAULT_MARKETING_WORKSPACE_ID,
): MarketingCommercialStage[] {
  return MARKETING_COMMERCIAL_STAGE_SEED.map((s) => ({
    ...s,
    workspaceId,
  }));
}
