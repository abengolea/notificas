import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveCampaignSenderDisplay, resolveCampaignSenderEmail } from "./campaign-sender";

test("admin on behalf of org: usa el mail de la empresa, no el de Notificas Admin", () => {
  assert.equal(
    resolveCampaignSenderEmail({
      managedByAdmin: true,
      campaignSenderEmail: "abengolea1@gmail.com",
      orgAdminEmail: "adrianbengolea@notificas.com",
      actorEmail: "abengolea1@gmail.com",
    }),
    "adrianbengolea@notificas.com"
  );
  assert.equal(
    resolveCampaignSenderEmail({
      managedByAdmin: true,
      orgAdminEmail: "adrianbengolea@notificas.com",
      actorEmail: "abengolea1@gmail.com",
    }),
    "adrianbengolea@notificas.com"
  );
});

test("empresa que envía ella: el actor es el remitente si la campaña no tiene mail", () => {
  assert.equal(
    resolveCampaignSenderEmail({
      actorEmail: "operador@empresa.com",
      orgAdminEmail: "admin@empresa.com",
    }),
    "operador@empresa.com"
  );
});

test("el sobre muestra el nombre de la empresa, no el mail", () => {
  assert.equal(
    resolveCampaignSenderDisplay({
      orgNombre: "Empresa Prueba",
      fallbackEmail: "adrianbengolea@notificas.com",
    }),
    "Empresa Prueba"
  );
  assert.equal(
    resolveCampaignSenderDisplay({ fallbackEmail: "adrianbengolea@notificas.com" }),
    "adrianbengolea@notificas.com"
  );
});

test("ignora un UID u otro valor sin @", () => {
  assert.equal(
    resolveCampaignSenderEmail({
      campaignSenderEmail: "YaPRt8ahI5giIFlRDXbMcfaAXo12",
      orgAdminEmail: "adrianbengolea@notificas.com",
    }),
    "adrianbengolea@notificas.com"
  );
});
