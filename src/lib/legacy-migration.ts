/** Origen de cuenta importada desde el sistema anterior (Nest/Postgres). */
export const LEGACY_MIGRATION_SOURCE = "legacy" as const;

/** Códigos devueltos por `POST /api/auth/legacy-migration-state` (solo email). */
export type LegacyMigrationStateCode =
  | "OK"
  | "MIGRATED_PENDING_PASSWORD"
  | "ACCOUNT_EXISTS";
