import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isConsumerAppPath,
  isEmpresaAppPath,
  isEmpresaOnlyUser,
} from "./user-account-kind";

test("alta admin marca empresa-only", () => {
  assert.equal(isEmpresaOnlyUser({ tipo: "empresa", createdByAdminOrg: true }), true);
});

test("operador creado por la org es empresa-only", () => {
  assert.equal(isEmpresaOnlyUser({ tipo: "empresa", createdByOrgAdmin: "org-1" }), true);
});

test("particular no es empresa-only aunque tenga otros campos", () => {
  assert.equal(isEmpresaOnlyUser({ tipo: "individual", email: "a@b.com" }), false);
  assert.equal(isEmpresaOnlyUser({}), false);
});

test("rutas de particulares vs empresas", () => {
  assert.equal(isConsumerAppPath("/dashboard"), true);
  assert.equal(isConsumerAppPath("/dashboard/cuenta"), true);
  assert.equal(isConsumerAppPath("/empresa"), false);
  assert.equal(isEmpresaAppPath("/empresa"), true);
  assert.equal(isEmpresaAppPath("/empresa/abc/dashboard"), true);
  assert.equal(isEmpresaAppPath("/dashboard"), false);
});
