import { CRM_TAXONOMY_MIGRATION_ID } from "./constants";
import type { TaxonomySeedMode } from "./types";

export type TaxonomyCliArgs = {
  mode: TaxonomySeedMode;
  confirm?: string;
  workspaceId?: string;
  outDir: string;
};

function readFlag(argv: string[], name: string): string | undefined {
  const prefix = `${name}=`;
  const inline = argv.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = argv.indexOf(name);
  if (index >= 0) return argv[index + 1];
  return undefined;
}

export function parseTaxonomyCliArgs(argv: string[]): TaxonomyCliArgs {
  const rawMode = (readFlag(argv, "--mode") || "preview").trim().toLowerCase();
  if (rawMode !== "preview" && rawMode !== "apply") {
    throw new Error(`Modo inválido: ${rawMode}. Usar preview (default) o apply.`);
  }
  return {
    mode: rawMode,
    confirm: readFlag(argv, "--confirm")?.trim(),
    workspaceId: readFlag(argv, "--workspace")?.trim(),
    outDir: readFlag(argv, "--out-dir")?.trim() || "artifacts",
  };
}

export function assertTaxonomyCli(args: TaxonomyCliArgs): void {
  if (args.mode === "preview") return;
  if (args.confirm !== CRM_TAXONOMY_MIGRATION_ID) {
    throw new Error(
      `APPLY_BLOCKED: se requiere --mode=apply --confirm=${CRM_TAXONOMY_MIGRATION_ID}. --apply solo no alcanza.`,
    );
  }
}
