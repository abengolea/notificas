const WORKSPACE_ID_RE = /^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/;

/** Workspace comercial interno de Notificas. Nunca es un `orgId` de cliente. */
export const DEFAULT_MARKETING_WORKSPACE_ID = "notificas-internal";

export const MARKETING_WORKSPACE_ENV = "MARKETING_WORKSPACE_ID";

function readConfiguredWorkspaceId(): string {
  return (process.env[MARKETING_WORKSPACE_ENV] || "").trim();
}

export function isMarketingWorkspaceId(value: string): boolean {
  return WORKSPACE_ID_RE.test(value);
}

/**
 * Tenant del CRM comercial. Un único workspace en v1; el id queda explícito
 * para permisos, staging y futuras unidades comerciales.
 *
 * No leer `orgId` de organizaciones de producto.
 */
export function getMarketingWorkspaceId(): string {
  const configured = readConfiguredWorkspaceId();
  if (!configured) return DEFAULT_MARKETING_WORKSPACE_ID;
  if (!isMarketingWorkspaceId(configured)) return DEFAULT_MARKETING_WORKSPACE_ID;
  return configured;
}
