import { test } from "node:test";
import assert from "node:assert/strict";
import {
  classifyRecontactRecipient,
  createMemoryRecontactStore,
  createRecontactListFromCampaign,
  defaultRecontactListName,
  mergeSendsForContact,
  pageRecontactRows,
  searchCampaignRecipients,
  type RecontactContactRecord,
  type RecontactSendRecord,
} from "./recontact";

const CAMPAIGN_ID = "camp_vaca";
const ORIGINAL_LIST = "list_original";

function send(partial: Partial<RecontactSendRecord> & { id: string; contactId: string }): RecontactSendRecord {
  return {
    campaignId: CAMPAIGN_ID,
    email: `${partial.contactId}@example.com`,
    name: partial.contactId,
    company: "YPF",
    country: "AR",
    status: "sent",
    sentAt: "2026-10-01T12:00:00.000Z",
    ...partial,
  };
}

function contact(partial: Partial<RecontactContactRecord> & { id: string }): RecontactContactRecord {
  return {
    email: `${partial.id}@example.com`,
    name: partial.id,
    company: "YPF",
    title: "Gerente",
    country: "AR",
    stage: "sent",
    listIds: [ORIGINAL_LIST],
    ...partial,
  };
}

function storeWith(rows: Array<{ send: RecontactSendRecord; contact?: RecontactContactRecord }>) {
  return createMemoryRecontactStore({
    campaigns: [
      {
        id: CAMPAIGN_ID,
        name: "Vaca Muerta | Servicios petroleros y perforación | Primera aproximación",
        status: "sent",
        listId: ORIGINAL_LIST,
        listName: "Vaca Muerta original",
        country: "AR",
      },
    ],
    lists: [{ id: ORIGINAL_LIST, name: "Vaca Muerta original", contactCount: rows.length }],
    sends: rows.map((r) => r.send),
    contacts: rows.map((r) => r.contact || contact({ id: String(r.send.contactId) })),
  });
}

test("sent + no open => candidato elegible", () => {
  const row = classifyRecontactRecipient({
    campaignId: CAMPAIGN_ID,
    send: send({ id: "s1", contactId: "c1" }),
    contact: contact({ id: "c1" }),
  });
  assert.equal(row.sent, true);
  assert.equal(row.opened, false);
  assert.equal(row.eligibleForRecontact, true);
  assert.equal(row.exclusionReason, null);
});

test("sent + opened => excluido", () => {
  const row = classifyRecontactRecipient({
    campaignId: CAMPAIGN_ID,
    send: send({ id: "s1", contactId: "c1", openedAt: "2026-10-01T13:00:00.000Z", status: "opened" }),
    contact: contact({ id: "c1", stage: "opened" }),
  });
  assert.equal(row.opened, true);
  assert.equal(row.eligibleForRecontact, false);
  assert.equal(row.exclusionReason, "opened");
});

test("no open + clicked => excluido", () => {
  const row = classifyRecontactRecipient({
    campaignId: CAMPAIGN_ID,
    send: send({ id: "s1", contactId: "c1", clickedAt: "2026-10-01T13:00:00.000Z", status: "clicked" }),
    contact: contact({ id: "c1", stage: "clicked" }),
  });
  assert.equal(row.opened, false);
  assert.equal(row.clicked, true);
  assert.equal(row.eligibleForRecontact, false);
  assert.equal(row.exclusionReason, "clicked");
});

test("no open + unsubscribed => excluido", () => {
  const row = classifyRecontactRecipient({
    campaignId: CAMPAIGN_ID,
    send: send({ id: "s1", contactId: "c1", status: "unsubscribed" }),
    contact: contact({ id: "c1", stage: "unsubscribed", unsubscribed: true }),
  });
  assert.equal(row.opened, false);
  assert.equal(row.unsubscribed, true);
  assert.equal(row.eligibleForRecontact, false);
  assert.equal(row.exclusionReason, "unsubscribed");
});

test("no open + bounced => excluido", () => {
  const row = classifyRecontactRecipient({
    campaignId: CAMPAIGN_ID,
    send: send({ id: "s1", contactId: "c1", status: "bounced", bouncedAt: "2026-10-01T13:00:00.000Z" }),
    contact: contact({ id: "c1", stage: "bounced" }),
  });
  assert.equal(row.opened, false);
  assert.equal(row.bounced, true);
  assert.equal(row.eligibleForRecontact, false);
  assert.equal(row.exclusionReason, "bounced");
});

test("no open + failed => excluido", () => {
  const row = classifyRecontactRecipient({
    campaignId: CAMPAIGN_ID,
    send: send({ id: "s1", contactId: "c1", status: "failed" }),
    contact: contact({ id: "c1" }),
  });
  assert.equal(row.opened, false);
  assert.equal(row.failed, true);
  assert.equal(row.eligibleForRecontact, false);
  assert.equal(row.exclusionReason, "failed");
});

test("do_not_contact => excluido", () => {
  const row = classifyRecontactRecipient({
    campaignId: CAMPAIGN_ID,
    send: send({ id: "s1", contactId: "c1" }),
    contact: contact({ id: "c1", doNotContact: true }),
  });
  assert.equal(row.eligibleForRecontact, false);
  assert.equal(row.exclusionReason, "do_not_contact");
});

test("24 enviados y 4 aperturas no implican 20 recontactables", async () => {
  const people: Array<{ send: RecontactSendRecord; contact?: RecontactContactRecord }> = [];
  for (let i = 1; i <= 24; i++) {
    const id = `c${i}`;
    if (i <= 4) {
      people.push({
        send: send({ id: `s${i}`, contactId: id, openedAt: "2026-10-02T10:00:00.000Z", status: "opened" }),
        contact: contact({ id, stage: "opened" }),
      });
    } else if (i === 5) {
      people.push({
        send: send({ id: `s${i}`, contactId: id, clickedAt: "2026-10-02T10:00:00.000Z", status: "clicked" }),
        contact: contact({ id, stage: "clicked" }),
      });
    } else if (i === 6) {
      people.push({
        send: send({ id: `s${i}`, contactId: id, status: "unsubscribed" }),
        contact: contact({ id, stage: "unsubscribed", unsubscribed: true }),
      });
    } else if (i === 7) {
      people.push({
        send: send({ id: `s${i}`, contactId: id, status: "bounced", bouncedAt: "2026-10-02T10:00:00.000Z" }),
        contact: contact({ id, stage: "bounced" }),
      });
    } else if (i === 8) {
      people.push({
        send: send({ id: `s${i}`, contactId: id, status: "failed" }),
        contact: contact({ id }),
      });
    } else {
      people.push({ send: send({ id: `s${i}`, contactId: id }), contact: contact({ id }) });
    }
  }
  const store = storeWith(people);
  const found = await searchCampaignRecipients(store, { campaignId: CAMPAIGN_ID, engagementStatus: "not_opened", limit: 100 });
  assert.equal(found.stats.sent, 24);
  assert.equal(found.stats.opened, 4);
  assert.notEqual(found.stats.eligibleForRecontact, 20);
  assert.equal(found.stats.notOpened, 20);
  assert.equal(found.stats.eligibleForRecontact, 16);
  assert.equal(found.stats.excluded, 4);
});

test("lista generada no modifica lista original", async () => {
  const store = storeWith([
    { send: send({ id: "s1", contactId: "c1" }), contact: contact({ id: "c1" }) },
    { send: send({ id: "s2", contactId: "c2", openedAt: "2026-10-02T10:00:00.000Z" }), contact: contact({ id: "c2" }) },
  ]);
  const before = store.snapshot();
  const created = await createRecontactListFromCampaign(store, {
    campaignId: CAMPAIGN_ID,
    filter: "not_opened",
    idempotencyKey: "k1",
  });
  const after = store.snapshot();
  const original = after.lists.find((l) => l.id === ORIGINAL_LIST);
  assert.equal(original?.contactCount, before.lists.find((l) => l.id === ORIGINAL_LIST)?.contactCount);
  assert.equal(created.originalListId, ORIGINAL_LIST);
  assert.equal(created.listId !== ORIGINAL_LIST, true);
  for (const contactRow of after.contacts) {
    const ids = Array.isArray(contactRow.listIds) ? contactRow.listIds.map(String) : [];
    assert.equal(ids.includes(ORIGINAL_LIST), true);
  }
  assert.equal(
    after.sends.map((s) => JSON.stringify(s)).join("|"),
    before.sends.map((s) => JSON.stringify(s)).join("|"),
  );
  assert.equal(
    after.campaigns.map((c) => JSON.stringify(c)).join("|"),
    before.campaigns.map((c) => JSON.stringify(c)).join("|"),
  );
  assert.equal(after.writes.some((w) => w.startsWith("campaign.") || w.startsWith("send.")), false);
});

test("idempotencia no duplica lista", async () => {
  const store = storeWith([{ send: send({ id: "s1", contactId: "c1" }), contact: contact({ id: "c1" }) }]);
  const first = await createRecontactListFromCampaign(store, {
    campaignId: CAMPAIGN_ID,
    filter: "not_opened",
    idempotencyKey: "same-key",
  });
  const second = await createRecontactListFromCampaign(store, {
    campaignId: CAMPAIGN_ID,
    filter: "not_opened",
    idempotencyKey: "same-key",
  });
  assert.equal(second.reused, true);
  assert.equal(second.listId, first.listId);
  assert.equal(store.snapshot().lists.filter((l) => l.id !== ORIGINAL_LIST).length, 1);
});

test("paginación estable por email/contactId", async () => {
  const people = ["c_zeta", "c_alfa", "c_beta"].map((id) => ({
    send: send({ id: `s_${id}`, contactId: id, email: `${id}@example.com` }),
    contact: contact({ id, email: `${id}@example.com` }),
  }));
  const store = storeWith(people);
  const page1 = await searchCampaignRecipients(store, {
    campaignId: CAMPAIGN_ID,
    engagementStatus: "not_opened",
    limit: 2,
  });
  assert.equal(page1.items.length, 2);
  assert.equal(page1.items[0].contactId, "c_alfa");
  assert.equal(page1.items[1].contactId, "c_beta");
  assert.ok(page1.nextCursor);
  const page2 = await searchCampaignRecipients(store, {
    campaignId: CAMPAIGN_ID,
    engagementStatus: "not_opened",
    limit: 2,
    cursor: page1.nextCursor,
  });
  assert.equal(page2.items.length, 1);
  assert.equal(page2.items[0].contactId, "c_zeta");
  assert.equal(page2.nextCursor, undefined);
  const replay = await searchCampaignRecipients(store, {
    campaignId: CAMPAIGN_ID,
    engagementStatus: "not_opened",
    limit: 2,
    cursor: page1.nextCursor,
  });
  assert.deepEqual(replay.items.map((r) => r.contactId), page2.items.map((r) => r.contactId));
});

test("contacto incluido una sola vez aunque haya eventos duplicados", async () => {
  const store = storeWith([
    { send: send({ id: "s1a", contactId: "c1", openedAt: null }), contact: contact({ id: "c1" }) },
    { send: send({ id: "s1b", contactId: "c1", openedAt: null, clickedAt: null }) },
  ]);
  const found = await searchCampaignRecipients(store, { campaignId: CAMPAIGN_ID, limit: 20 });
  assert.equal(found.items.filter((r) => r.contactId === "c1").length, 1);
  const merged = mergeSendsForContact([
    send({ id: "a", contactId: "c1" }),
    send({ id: "b", contactId: "c1", openedAt: "2026-10-02T10:00:00.000Z" }),
  ]);
  assert.equal(Boolean(merged.openedAt), true);
});

test("historial original permanece intacto al crear lista", async () => {
  const store = storeWith([
    {
      send: send({
        id: "s1",
        contactId: "c1",
        sentAt: "2026-10-01T12:00:00.000Z",
        openedAt: null,
      }),
      contact: contact({ id: "c1" }),
    },
  ]);
  const before = store.snapshot();
  await createRecontactListFromCampaign(store, {
    campaignId: CAMPAIGN_ID,
    filter: "not_opened",
    idempotencyKey: "hist",
  });
  const after = store.snapshot();
  assert.deepEqual(after.sends, before.sends);
  assert.deepEqual(after.campaigns, before.campaigns);
  assert.equal(after.contacts[0].email, before.contacts[0].email);
  assert.equal((after.contacts[0].listIds as string[]).includes(ORIGINAL_LIST), true);
});

test("nombre default de lista de recontacto", () => {
  const name = defaultRecontactListName(1, "Vaca Muerta | Servicios petroleros");
  assert.equal(name.startsWith("RECONTACTO 01 | No apertura | "), true);
  assert.ok(name.includes("Vaca Muerta"));
});

test("pageRecontactRows no salta ni duplica", () => {
  const rows = ["a", "b", "c", "d"].map((id) =>
    classifyRecontactRecipient({
      campaignId: CAMPAIGN_ID,
      send: send({ id: `s${id}`, contactId: id, email: `${id}@x.com` }),
      contact: contact({ id, email: `${id}@x.com` }),
    }),
  );
  const sorted = [...rows].sort((a, b) => a.contactId.localeCompare(b.contactId));
  const first = pageRecontactRows(sorted, 2);
  const second = pageRecontactRows(sorted, 2, first.nextCursor);
  assert.deepEqual(
    [...first.items, ...second.items].map((r) => r.contactId),
    sorted.map((r) => r.contactId),
  );
});
