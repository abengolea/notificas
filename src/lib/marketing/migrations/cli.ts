import { CRM_COMPANIES_MIGRATION_BATCH_SIZE, CRM_COMPANIES_MIGRATION_ID } from "./constants";
import type { CompanyMigrationMode } from "./types";

export type CompanyMigrationCliArgs = {
  mode: CompanyMigrationMode;
  confirm?: string;
  workspaceId?: string;
  outDir: string;
  batchSize: number;
};

function readFlag(argv: string[], name: string): string | undefined {
  const prefix = `${name}=`;
  const inline = argv.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = argv.indexOf(name);
  if (index >= 0) return argv[index + 1];
  return undefined;
}

export function parseCompanyMigrationCliArgs(argv: string[]): CompanyMigrationCliArgs {
  const rawMode = (readFlag(argv, "--mode") || "preview").trim().toLowerCase();
  if (rawMode !== "preview" && rawMode !== "apply" && rawMode !== "status") {
    throw new Error(`Modo inválido: ${rawMode}. Usar preview (default), status o apply.`);
  }
  const batchRaw = readFlag(argv, "--batch-size");
  const batchSize = batchRaw ? Number(batchRaw) : CRM_COMPANIES_MIGRATION_BATCH_SIZE;
  if (!Number.isFinite(batchSize) || batchSize < 1) {
    throw new Error("--batch-size inválido");
  }
  return {
    mode: rawMode,
    confirm: readFlag(argv, "--confirm")?.trim(),
    workspaceId: readFlag(argv, "--workspace")?.trim(),
    outDir: readFlag(argv, "--out-dir")?.trim() || "artifacts",
    batchSize: Math.floor(batchSize),
  };
}

export function assertCompanyMigrationCli(args: CompanyMigrationCliArgs): void {
  if (args.mode === "preview" || args.mode === "status") return;
  if (args.confirm !== CRM_COMPANIES_MIGRATION_ID) {
    throw new Error(
      `APPLY_BLOCKED: se requiere --mode=apply --confirm=${CRM_COMPANIES_MIGRATION_ID}. --apply solo no alcanza.`,
    );
  }
}
