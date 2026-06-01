/** Origen de cuenta importada desde el sistema anterior (Nest/Postgres). */
export const LEGACY_MIGRATION_SOURCE = "legacy" as const;

/** Alta de responsable de empresa desde panel admin (invitación + contraseña). */
export const ADMIN_EMPRESA_ONBOARDING_SOURCE = "admin_empresa" as const;

export type AccountOnboardingSource =
  | typeof LEGACY_MIGRATION_SOURCE
  | typeof ADMIN_EMPRESA_ONBOARDING_SOURCE;

/** Perfil con contraseña pendiente (legacy o alta admin empresa). */
export function hasPendingPasswordOnboarding(data: Record<string, unknown> | undefined): boolean {
  if (!data || data.mustSetPassword !== true) return false;
  const src = data.migrationSource;
  return src === LEGACY_MIGRATION_SOURCE || src === ADMIN_EMPRESA_ONBOARDING_SOURCE;
}

/** Códigos devueltos por `POST /api/auth/legacy-migration-state` (solo email). */
export type LegacyMigrationStateCode =
  | "OK"
  | "MIGRATED_PENDING_PASSWORD"
  | "ACCOUNT_EXISTS";
