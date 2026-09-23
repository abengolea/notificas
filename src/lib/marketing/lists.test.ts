import { test } from "node:test";
import assert from "node:assert/strict";
import {
  contactMatchesSource,
  countryListKey,
  decorateRecipient,
  listNameKey,
  namedRecipientSource,
  parseRecipientSource,
  toRecipientRow,
} from "./lists";

test("parsea lista nominada y atajo por país", () => {
  assert.deepEqual(parseRecipientSource("country:CU"), { kind: "country", country: "CU" });
  assert.deepEqual(parseRecipientSource("country:all"), { kind: "country", country: "all" });
  assert.deepEqual(parseRecipientSource("abc123"), { kind: "list", listId: "abc123" });
  assert.equal(parseRecipientSource("").kind, "none");
  assert.equal(countryListKey("cu"), "country:CU");
});

test("sin lista nominada no se envía a todo el país", () => {
  assert.equal(namedRecipientSource({ country: "CU" }).kind, "none");
  assert.equal(namedRecipientSource({ listId: "country:CU" }).kind, "none");
  assert.deepEqual(namedRecipientSource({ listId: "lista-cuba" }), { kind: "list", listId: "lista-cuba" });
});

test("un contacto entra en su lista y en el atajo de país", () => {
  const c = { country: "CU", listIds: ["lista-cuba"] };
  assert.equal(contactMatchesSource(c, { kind: "list", listId: "lista-cuba" }), true);
  assert.equal(contactMatchesSource(c, { kind: "list", listId: "otra" }), false);
  assert.equal(contactMatchesSource(c, { kind: "country", country: "CU" }), true);
  assert.equal(contactMatchesSource(c, { kind: "country", country: "AR" }), false);
  assert.equal(contactMatchesSource(c, { kind: "country", country: "all" }), true);
});

test("etapas excluidas no son enviables", () => {
  const row = toRecipientRow({ id: "1", email: "a@x.com", stage: "sent", listIds: [] });
  assert.equal(row.eligible, true);
  const filtered = decorateRecipient(row, new Set(["new"]));
  assert.equal(filtered.eligible, false);
  assert.equal(filtered.skipReason, "Fuera de las etapas elegidas");
  const bounced = toRecipientRow({ id: "2", email: "b@x.com", stage: "bounced" });
  assert.equal(bounced.eligible, false);
});

test("contactos sin email válido nunca son elegibles para campañas de email", () => {
  const linkedinOnly = toRecipientRow({ id: "linkedin", email: "", stage: "new" });
  assert.equal(linkedinOnly.eligible, false);
  assert.equal(linkedinOnly.skipReason, "Email inválido o faltante");
  const malformed = toRecipientRow({ id: "bad", email: "not-an-email", stage: "new" });
  assert.equal(malformed.eligible, false);
  const valid = toRecipientRow({ id: "email", email: " VALID@EXAMPLE.COM ", stage: "new" });
  assert.equal(valid.eligible, true);
  assert.equal(valid.email, "valid@example.com");
});

test("nombre de lista se normaliza", () => {
  assert.equal(listNameKey("  Cuba   marzo  "), "cuba marzo");
});
