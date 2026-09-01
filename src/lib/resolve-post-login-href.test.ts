import { test } from "node:test";
import assert from "node:assert/strict";
import { empresaHomeHrefFromOrgs } from "./resolve-post-login-href";

test("una sola org va al dashboard de esa empresa", () => {
  assert.equal(empresaHomeHrefFromOrgs([{ id: "org-1", nombre: "Acme" }]), "/empresa/org-1/dashboard");
});

test("varias orgs van al selector", () => {
  assert.equal(
    empresaHomeHrefFromOrgs([{ id: "a" }, { id: "b" }]),
    "/empresa",
  );
});

test("sin orgs no redirige al módulo empresas", () => {
  assert.equal(empresaHomeHrefFromOrgs([]), null);
  assert.equal(empresaHomeHrefFromOrgs([{ nombre: "sin id" }]), null);
});
