import { emptyInvoiceCounts, type AdminInvoiceCounts } from "./admin-invoice-status";

export const BILLING_HEALTH_LEVELS = ["ok", "warn", "fail"] as const;
export type BillingHealthLevel = (typeof BILLING_HEALTH_LEVELS)[number];

export type BillingHealthChecks = {
  emitEnabled: boolean;
  hubConfigured: boolean;
  hubReachable: boolean;
  hubHttpStatus: number | null;
  hubError: string | null;
};

export type BillingHealthSnapshot = {
  checkedAt: string;
  level: BillingHealthLevel;
  ok: boolean;
  checks: BillingHealthChecks;
  counts24h: AdminInvoiceCounts;
  problems: string[];
  alertSent: boolean;
};

export function emptyBillingHealthChecks(): BillingHealthChecks {
  return {
    emitEnabled: false,
    hubConfigured: false,
    hubReachable: false,
    hubHttpStatus: null,
    hubError: null,
  };
}

export function evaluateBillingHealth(input: {
  checks: BillingHealthChecks;
  counts24h: AdminInvoiceCounts;
}): { level: BillingHealthLevel; problems: string[] } {
  const problems: string[] = [];
  const { checks, counts24h } = input;

  if (!checks.emitEnabled) {
    problems.push("La emisión automática está apagada (MERCADOPAGO_HUB_EMIT_FACTURA).");
  }
  if (!checks.hubConfigured) {
    problems.push("Falta la URL o el secret del Hub de facturación.");
  }
  if (checks.hubConfigured && !checks.hubReachable) {
    problems.push(checks.hubError || "El Hub no respondió.");
  } else if (checks.hubError) {
    problems.push(checks.hubError);
  }
  if (counts24h.failed > 0) {
    problems.push(
      `${counts24h.failed} compra${counts24h.failed === 1 ? "" : "s"} de las últimas 24 h sin factura emitida.`,
    );
  }
  if (counts24h.none > 0) {
    problems.push(
      `${counts24h.none} compra${counts24h.none === 1 ? "" : "s"} de las últimas 24 h sin intento de facturación.`,
    );
  }
  if (counts24h.pending > 0) {
    problems.push(
      `${counts24h.pending} compra${counts24h.pending === 1 ? "" : "s"} con factura pendiente.`,
    );
  }

  const hardFail =
    !checks.emitEnabled ||
    !checks.hubConfigured ||
    !checks.hubReachable ||
    Boolean(checks.hubError) ||
    counts24h.failed > 0 ||
    counts24h.none > 0;

  if (hardFail) return { level: "fail", problems };
  if (counts24h.pending > 0) return { level: "warn", problems };
  return { level: "ok", problems };
}

export function billingHealthFingerprint(snapshot: Pick<BillingHealthSnapshot, "level" | "problems">): string {
  return `${snapshot.level}|${snapshot.problems.join("|")}`;
}

export function defaultBillingHealthSnapshot(): BillingHealthSnapshot {
  return {
    checkedAt: new Date(0).toISOString(),
    level: "fail",
    ok: false,
    checks: emptyBillingHealthChecks(),
    counts24h: emptyInvoiceCounts(),
    problems: [],
    alertSent: false,
  };
}
