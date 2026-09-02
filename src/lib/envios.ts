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

export type EmpresaMassSendSaldoMessage = {
  empty: boolean;
  title: string;
  body: string;
};

/** Primer aviso de saldo cuando la empresa arma un envío masivo por su cuenta. */
export function empresaMassSendSaldoMessage(creditos: unknown): EmpresaMassSendSaldoMessage {
  const n = normalizeEnviosDisponibles(creditos);
  if (n <= 0) {
    return {
      empty: true,
      title: "No tenés envíos para hacer",
      body: "El saldo es 0. Pedile al administrador que te asigne envíos. Podés armar un borrador, pero no se puede despachar un envío masivo hasta que haya saldo.",
    };
  }
  return {
    empty: false,
    title: `Tenés ${n.toLocaleString("es-AR")} ${n === 1 ? "envío" : "envíos"} para hacer masivamente`,
    body: "Cada destinatario consume 1 envío. Si el lote supera tu saldo, el envío no arranca.",
  };
}
