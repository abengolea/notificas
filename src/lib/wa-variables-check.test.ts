import { test } from "node:test";
import assert from "node:assert/strict";
import { checkWaVariables } from "./wa-variables-check";

test("campo_N sin asignar bloquea aunque no haya destinatarios cargados", () => {
  const r = checkWaVariables({ variables: ["nombre", "campo_2", "url_lectura"] });
  assert.equal(r.ok, false);
  assert.equal(r.problems[0].n, 2);
  assert.equal(r.problems[0].kind, "sin_asignar");
  assert.match(r.message, /\{\{2\}\}/);
});

test("variable vacía también bloquea", () => {
  assert.equal(checkWaVariables({ variables: ["nombre", ""] }).ok, false);
  assert.equal(checkWaVariables({ variables: ["nombre", "="] }).ok, false);
});

test("las variables automáticas y el texto fijo no piden datos", () => {
  const r = checkWaVariables({
    variables: ["nombre", "remitente", "url_lectura", "=Hola"],
    rows: [{ nombre: "Ana", email: "a@a.com" }],
  });
  assert.equal(r.ok, true);
});

test("detecta destinatarios sin el dato que pide la variable", () => {
  const r = checkWaVariables({
    variables: ["nombre", "monto"],
    rows: [
      { nombre: "Ana", monto: "100" },
      { nombre: "Beto", monto: "" },
      { nombre: "Cora" },
    ],
  });
  assert.equal(r.ok, false);
  assert.equal(r.problems[0].kind, "dato_vacio");
  assert.equal(r.problems[0].affected, 2);
  assert.deepEqual(r.problems[0].sample, ["Beto", "Cora"]);
});

test("el 0 es un dato válido", () => {
  const r = checkWaVariables({ variables: ["nombre", "dias"], rows: [{ nombre: "Ana", dias: "0" }] });
  assert.equal(r.ok, true);
});

test("con botón URL la variable del link no cuenta", () => {
  const r = checkWaVariables({ variables: ["nombre", "url_lectura"], urlButton: true, rows: [{ nombre: "Ana" }] });
  assert.equal(r.ok, true);
});

test("en mixtas solo se exige a quienes tienen teléfono", () => {
  const r = checkWaVariables({
    variables: ["nombre", "dni"],
    onlyWithPhone: true,
    rows: [{ nombre: "Ana", telefono: "+5491111", dni: "1" }, { nombre: "Beto", dni: "" }],
  });
  assert.equal(r.ok, true);
});
