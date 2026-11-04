import { test } from "node:test";
import assert from "node:assert/strict";
import { maskPhoneForLote } from "./mask-phone";

test("enmascara un celular argentino y deja área y últimos 3", () => {
  assert.equal(maskPhoneForLote("+5493364645357"), "+54 9 336 ***-*357");
  assert.equal(maskPhoneForLote("5493364312520"), "+54 9 336 ***-*520");
});

test("sin número usable muestra raya", () => {
  assert.equal(maskPhoneForLote(""), "—");
  assert.equal(maskPhoneForLote("123"), "—");
});
