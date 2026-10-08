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

/** Canal de un envío individual (1:1). En masivos, `ambos` sigue valiendo 1 por destinatario. */
export type CanalIndividual = "email" | "whatsapp" | "ambos";

/** En individual, cada vía es un envío. Email+WhatsApp = 2. */
export function creditsRequiredForIndividualSend(canal: CanalIndividual): number {
  return canal === "ambos" ? 2 : 1;
}

/** Misma regla 1:1 a partir del documento `mail`. */
export function creditsRequiredForMailDoc(mail: {
  waOnly?: unknown;
  recipientPhone?: unknown;
}): number {
  const waOnly = mail.waOnly === true;
  const phone = String(mail.recipientPhone ?? "").trim();
  if (!waOnly && phone) return 2;
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
      title: "La empresa no tiene envíos",
      body: "El saldo de la empresa es 0. Pedile a Notificas que recargue envíos. Podés armar un borrador, pero no se puede despachar un envío masivo hasta que haya saldo.",
    };
  }
  return {
    empty: false,
    title: `La empresa tiene ${n.toLocaleString("es-AR")} ${n === 1 ? "envío" : "envíos"}`,
    body: "Cada destinatario consume 1 envío del saldo de la empresa. Si el lote supera el saldo, el envío no arranca.",
  };
}
