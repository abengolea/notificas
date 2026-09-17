import { DEFAULT_MARKETING_WORKSPACE_ID } from "../workspace";
import type { MarketingServiceContext } from "../context";
import { MarketingNotFoundError, MarketingWorkspaceMismatchError } from "../errors";
import { nowIso } from "../persistence/timestamps";

export function resolveContactWorkspace(workspaceId: string | undefined): string {
  return workspaceId || DEFAULT_MARKETING_WORKSPACE_ID;
}

export function assertWorkspaceOwned(
  ctx: MarketingServiceContext,
  docWorkspaceId: string | undefined,
  options?: { legacyContact?: boolean },
): string {
  const resolved = options?.legacyContact
    ? resolveContactWorkspace(docWorkspaceId)
    : docWorkspaceId;
  if (!resolved || resolved !== ctx.workspaceId) {
    throw new MarketingWorkspaceMismatchError();
  }
  return resolved;
}

export function requireFound<T>(value: T | null | undefined, entity: string, id?: string): T {
  if (!value) throw new MarketingNotFoundError(entity, id);
  return value;
}

export function createStamps(ctx: MarketingServiceContext): {
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
} {
  const at = nowIso();
  return {
    createdAt: at,
    updatedAt: at,
    createdBy: ctx.actorId,
    updatedBy: ctx.actorId,
  };
}

export function updateStamps(ctx: MarketingServiceContext): {
  updatedAt: string;
  updatedBy?: string;
} {
  return { updatedAt: nowIso(), updatedBy: ctx.actorId };
}
