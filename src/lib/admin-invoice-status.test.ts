import assert from "node:assert/strict";
import { test } from "node:test";

import {
  adminInvoiceStatusLabel,
  emptyInvoiceCounts,
  normalizeAdminInvoiceStatus,
} from "./admin-invoice-status";

test("normalizeAdminInvoiceStatus reconoce issued, pending y failed", () => {
  assert.equal(normalizeAdminInvoiceStatus({ status: "issued" }), "issued");
  assert.equal(normalizeAdminInvoiceStatus({ status: "PENDING" }), "pending");
  assert.equal(normalizeAdminInvoiceStatus({ status: "failed" }), "failed");
});

test("normalizeAdminInvoiceStatus trata ausencia o valor raro como sin intento", () => {
  assert.equal(normalizeAdminInvoiceStatus(undefined), "none");
  assert.equal(normalizeAdminInvoiceStatus(null), "none");
  assert.equal(normalizeAdminInvoiceStatus({}), "none");
  assert.equal(normalizeAdminInvoiceStatus({ status: "ok" }), "none");
});

test("adminInvoiceStatusLabel cubre los cuatro estados visibles", () => {
  assert.equal(adminInvoiceStatusLabel("issued"), "Emitida");
  assert.equal(adminInvoiceStatusLabel("pending"), "Pendiente");
  assert.equal(adminInvoiceStatusLabel("failed"), "No emitida");
  assert.equal(adminInvoiceStatusLabel("none"), "Sin intento");
});

test("emptyInvoiceCounts arranca en cero", () => {
  assert.deepEqual(emptyInvoiceCounts(), {
    issued: 0,
    pending: 0,
    failed: 0,
    none: 0,
    total: 0,
  });
});
