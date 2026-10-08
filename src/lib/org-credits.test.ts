import { test } from "node:test";
import assert from "node:assert/strict";
import { orgCreditsNeedSeed, planOrgCreditsSeed } from "./org-credits";

test("org sin creditos numérico necesita semilla", () => {
  assert.equal(orgCreditsNeedSeed(undefined), true);
  assert.equal(orgCreditsNeedSeed(null), true);
  assert.equal(orgCreditsNeedSeed("50"), true);
  assert.equal(orgCreditsNeedSeed(Number.NaN), true);
  assert.equal(orgCreditsNeedSeed(0), false);
  assert.equal(orgCreditsNeedSeed(50), false);
});

test("semilla copia el saldo del admin y lo marca para mover", () => {
  const seeded = planOrgCreditsSeed(undefined, 50);
  assert.equal(seeded.seeded, true);
  assert.equal(seeded.creditos, 50);
  assert.equal(seeded.takeFromAdmin, 50);

  const already = planOrgCreditsSeed(12, 50);
  assert.equal(already.seeded, false);
  assert.equal(already.creditos, 12);
  assert.equal(already.takeFromAdmin, 0);

  const empty = planOrgCreditsSeed(undefined, undefined);
  assert.equal(empty.seeded, true);
  assert.equal(empty.creditos, 0);
  assert.equal(empty.takeFromAdmin, 0);
});
