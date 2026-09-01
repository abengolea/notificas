import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildIndividualDashboardStats,
  isCampaignMailDoc,
  mailBelongsToOrg,
  mapMailToIndividualSend,
} from "./empresa-individual-stats";

test("excluye mails de envío masivo", () => {
  assert.equal(isCampaignMailDoc({ campaignId: "c1" }), true);
  assert.equal(isCampaignMailDoc({ campaignMessageId: "m1" }), true);
  assert.equal(isCampaignMailDoc({ subject: "hola" }), false);
});

test("acepta mails sin org o de la misma org", () => {
  assert.equal(mailBelongsToOrg({}, "org-1"), true);
  assert.equal(mailBelongsToOrg({ orgId: "org-1" }, "org-1"), true);
  assert.equal(mailBelongsToOrg({ orgId: "otra" }, "org-1"), false);
});

test("mapea destinatario, asunto y estado leído", () => {
  const row = mapMailToIndividualSend("m1", {
    recipientEmail: "ana@correo.com",
    message: { subject: "Intimación" },
    createdAt: new Date("2026-08-02T12:00:00.000Z"),
    tracking: { movements: [{ type: "email_sent" }, { type: "read_confirmed" }] },
  });
  assert.equal(row.to, "ana@correo.com");
  assert.equal(row.subject, "Intimación");
  assert.equal(row.lastStatus, "Leído");
});

test("cuenta totales y recientes", () => {
  const now = new Date("2026-09-01T12:00:00.000Z");
  const stats = buildIndividualDashboardStats(
    [
      {
        id: "a",
        sentAt: new Date("2026-09-01T10:00:00.000Z"),
        to: "a@x.com",
        subject: "A",
        lastStatus: "Leído",
      },
      {
        id: "b",
        sentAt: new Date("2026-08-01T10:00:00.000Z"),
        to: "b@x.com",
        subject: "B",
        lastStatus: "Rebotó",
      },
    ],
    now,
  );
  assert.equal(stats.total, 2);
  assert.equal(stats.esteMes, 1);
  assert.equal(stats.leidos, 1);
  assert.equal(stats.rebotes, 1);
  assert.equal(stats.recientes[0].id, "a");
});
