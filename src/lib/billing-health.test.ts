import assert from "node:assert/strict";
import { test } from "node:test";

import { emptyInvoiceCounts } from "./admin-invoice-status";
import {
  billingHealthFingerprint,
  emptyBillingHealthChecks,
  evaluateBillingHealth,
} from "./billing-health";

const healthyChecks = {
  emitEnabled: true,
  hubConfigured: true,
  hubReachable: true,
  hubHttpStatus: 200,
  hubError: null,
};

test("evaluateBillingHealth es ok si config y Hub están bien y no hay fallos", () => {
  const result = evaluateBillingHealth({
    checks: healthyChecks,
    counts24h: { ...emptyInvoiceCounts(), issued: 3, total: 3 },
  });
  assert.equal(result.level, "ok");
  assert.equal(result.problems.length, 0);
});

test("evaluateBillingHealth avisa si hay facturas pendientes", () => {
  const result = evaluateBillingHealth({
    checks: healthyChecks,
    counts24h: { ...emptyInvoiceCounts(), issued: 1, pending: 2, total: 3 },
  });
  assert.equal(result.level, "warn");
  assert.match(result.problems.join(" "), /pendiente/);
});

test("evaluateBillingHealth falla si el Hub no responde o la emisión está apagada", () => {
  const hubDown = evaluateBillingHealth({
    checks: { ...healthyChecks, hubReachable: false, hubError: "Hub no respondió" },
    counts24h: emptyInvoiceCounts(),
  });
  assert.equal(hubDown.level, "fail");

  const disabled = evaluateBillingHealth({
    checks: { ...emptyBillingHealthChecks(), hubConfigured: true, hubReachable: true },
    counts24h: emptyInvoiceCounts(),
  });
  assert.equal(disabled.level, "fail");
  assert.match(disabled.problems.join(" "), /apagada/);
});

test("evaluateBillingHealth falla si hubo compras sin factura", () => {
  const result = evaluateBillingHealth({
    checks: healthyChecks,
    counts24h: { ...emptyInvoiceCounts(), failed: 1, issued: 2, total: 3 },
  });
  assert.equal(result.level, "fail");
  assert.match(result.problems.join(" "), /sin factura emitida/);
});

test("billingHealthFingerprint cambia cuando cambian los problemas", () => {
  const a = billingHealthFingerprint({ level: "fail", problems: ["uno"] });
  const b = billingHealthFingerprint({ level: "fail", problems: ["dos"] });
  assert.notEqual(a, b);
});
