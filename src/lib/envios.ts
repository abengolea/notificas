/** Saldo de envíos disponibles (campo Firestore `creditos`). Nunca negativo. */
export function normalizeEnviosDisponibles(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
}
