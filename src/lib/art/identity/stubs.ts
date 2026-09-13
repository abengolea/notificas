import { IdentityProviderNotConfiguredError, type IdentityProvider } from "@/lib/art/identity/types";
import { emptyIdentityResult } from "@/lib/art/identity/types";
import type { NormalizedIdentityResult } from "@/lib/art/types";

/** Stub: no llama a RENAPER ni guarda biometría. Punto de conexión futuro. */
export class RenaperIdentityProvider implements IdentityProvider {
  readonly id = "RENAPER" as const;

  async startVerification(): Promise<NormalizedIdentityResult> {
    throw new IdentityProviderNotConfiguredError(this.id);
  }

  async checkVerification(): Promise<NormalizedIdentityResult> {
    throw new IdentityProviderNotConfiguredError(this.id);
  }

  normalizeResult(raw: unknown): NormalizedIdentityResult {
    const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
    return emptyIdentityResult(this.id, String(obj.transactionId || ""), {
      rawReference: typeof obj.reference === "string" ? obj.reference : null,
    });
  }
}

/** Stub: no llama a Didit ni guarda biometría. Punto de conexión futuro. */
export class DiditIdentityProvider implements IdentityProvider {
  readonly id = "DIDIT" as const;

  async startVerification(): Promise<NormalizedIdentityResult> {
    throw new IdentityProviderNotConfiguredError(this.id);
  }

  async checkVerification(): Promise<NormalizedIdentityResult> {
    throw new IdentityProviderNotConfiguredError(this.id);
  }

  normalizeResult(raw: unknown): NormalizedIdentityResult {
    const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
    return emptyIdentityResult(this.id, String(obj.transactionId || ""), {
      rawReference: typeof obj.reference === "string" ? obj.reference : null,
    });
  }
}
