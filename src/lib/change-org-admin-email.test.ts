import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeAdminEmail, planChangeOrgAdminEmail } from "./change-org-admin-email";

test("normaliza el email del administrador", () => {
  assert.equal(normalizeAdminEmail("  Foo@Colegio.COM "), "foo@colegio.com");
});

test("si el email no cambia, no hace nada", () => {
  const plan = planChangeOrgAdminEmail({
    currentAdminUid: "u1",
    currentAdminEmail: "a@test.com",
    nextEmail: "A@test.com",
    existingUserByNextEmail: { uid: "u1" },
    nextEmailOwnsOtherOrg: false,
  });
  assert.equal(plan.action, "noop");
});

test("si el mail nuevo está libre, renombra la misma cuenta", () => {
  const plan = planChangeOrgAdminEmail({
    currentAdminUid: "u1",
    currentAdminEmail: "adrian@test.com",
    nextEmail: "colegio@abogados.com",
    existingUserByNextEmail: null,
    nextEmailOwnsOtherOrg: false,
  });
  assert.deepEqual(plan, {
    action: "rename",
    adminUid: "u1",
    from: "adrian@test.com",
    to: "colegio@abogados.com",
  });
});

test("si el mail nuevo ya es admin de otra org, bloquea", () => {
  const plan = planChangeOrgAdminEmail({
    currentAdminUid: "u1",
    currentAdminEmail: "adrian@test.com",
    nextEmail: "otro@empresa.com",
    existingUserByNextEmail: { uid: "u2" },
    nextEmailOwnsOtherOrg: true,
  });
  assert.equal(plan.action, "conflict");
});

test("si el mail nuevo ya tiene cuenta, transfiere el admin a ese uid", () => {
  const plan = planChangeOrgAdminEmail({
    currentAdminUid: "u1",
    currentAdminEmail: "adrian@test.com",
    nextEmail: "colegio@abogados.com",
    existingUserByNextEmail: { uid: "u9" },
    nextEmailOwnsOtherOrg: false,
  });
  assert.deepEqual(plan, {
    action: "reassign",
    fromUid: "u1",
    toUid: "u9",
    fromEmail: "adrian@test.com",
    toEmail: "colegio@abogados.com",
    createUser: false,
  });
});
