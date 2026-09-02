import { test } from "node:test";
import assert from "node:assert/strict";
import { empresaMassSendSaldoMessage, normalizeEnviosDisponibles } from "./envios";

test("normalizeEnviosDisponibles no deja saldo negativo", () => {
  assert.equal(normalizeEnviosDisponibles(-3), 0);
  assert.equal(normalizeEnviosDisponibles(12.9), 12);
  assert.equal(normalizeEnviosDisponibles(undefined), 0);
});

test("saldo 0 avisa que no hay envíos para hacer", () => {
  const msg = empresaMassSendSaldoMessage(0);
  assert.equal(msg.empty, true);
  assert.match(msg.title, /No tenés envíos/);
});

test("saldo positivo dice cuántos envíos hay para el masivo", () => {
  const uno = empresaMassSendSaldoMessage(1);
  assert.equal(uno.empty, false);
  assert.match(uno.title, /1 envío/);
  const muchos = empresaMassSendSaldoMessage(1500);
  assert.match(muchos.title, /1\.500 envíos|1,500 envíos/);
});
