const TRUE = new Set(["1", "true", "yes", "on"]);

function envFlag(name: string): boolean {
  return TRUE.has((process.env[name] || "").trim().toLowerCase());
}

/**
 * Autorización server-side. Toda API, alta, adhesión y gate SRT depende de esto.
 * Manipular Javascript / NEXT_PUBLIC no puede activar el módulo.
 */
export function artModuleEnabled(): boolean {
  return envFlag("ART_MODULE_ENABLED");
}

/**
 * Hint de menú/UX únicamente. Nunca usar para autorización, endpoints ni el gate SRT.
 */
export function artModuleUiHint(): boolean {
  return envFlag("NEXT_PUBLIC_ART_MODULE_ENABLED");
}
