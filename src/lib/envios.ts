/** Saldo de envíos disponibles (campo Firestore `creditos`). Nunca negativo. */
export function normalizeEnviosDisponibles(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
}

/** Un envío certificado (WhatsApp o email) consume exactamente 1 crédito. */
export function creditsRequiredForNotification(channel?: "whatsapp" | "email"): number {
  void channel;
  return 1;
}

export function canAffordCredits(available: unknown, needed: number): boolean {
  return normalizeEnviosDisponibles(available) >= Math.max(0, Math.floor(needed));
}
