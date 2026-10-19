import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { bumpListCount } from "./audience";
import { MARKETING_CAMPAIGNS, MARKETING_CONTACTS, MARKETING_LISTS, MARKETING_SENDS } from "./collections";
import { isValidEmail, normalizeEmail } from "./csv";
import { serializeAdminDoc } from "./events";
import { listNameKey } from "./lists";
import { isMarketingCountryCode, type MarketingCountryCode } from "./countries";
import { MarketingNotFoundError, MarketingValidationError } from "./errors";
import { decodeMarketingCursor, encodeMarketingCursor, clampMarketingLimit } from "./pagination";
import { isSendableStage } from "./stages";

export const RECONTACT_ENGAGEMENT_STATUSES = [
  "all",
  "opened",
  "not_opened",
  "clicked",
  "replied",
  "bounced",
  "unsubscribed",
  "failed",
] as const;

export type RecontactEngagementStatus = (typeof RECONTACT_ENGAGEMENT_STATUSES)[number];

export const RECONTACT_EXCLUSION_REASONS = [
  "not_sent",
  "opened",
  "clicked",
  "replied",
  "unsubscribed",
  "bounced",
  "failed",
  "do_not_contact",
  "invalid_email",
  "contact_deleted",
  "not_eligible",
  "already_recontacted",
] as const;

export type RecontactExclusionReason = (typeof RECONTACT_EXCLUSION_REASONS)[number];

export const RECONTACT_FILTER = "not_opened" as const;
export const RECONTACT_SEND_SCAN_LIMIT = 5000;
const CONTACT_GET_CHUNK = 100;
const LIST_WRITE_CHUNK = 400;

export type RecontactEngagementFlags = {
  sent: boolean;
  opened: boolean;
  clicked: boolean;
  replied: boolean;
  bounced: boolean;
  unsubscribed: boolean;
  failed: boolean;
};

export type RecontactRecipientRow = {
  contactId: string;
  campaignId: string;
  name: string;
  email: string;
  company: string;
  title: string;
  countryCode: string;
  sentAt: string | null;
  openedAt: string | null;
  clickedAt: string | null;
  repliedAt: string | null;
  bouncedAt: string | null;
  unsubscribedAt: string | null;
  failedAt: string | null;
  eligibleForRecontact: boolean;
  exclusionReason: RecontactExclusionReason | null;
} & RecontactEngagementFlags;

export type RecontactRecipientStats = {
  total: number;
  sent: number;
  opened: number;
  clicked: number;
  replied: number;
  notOpened: number;
  unsubscribed: number;
  bounced: number;
  failed: number;
  eligibleForRecontact: number;
  excluded: number;
};

export type RecontactExclusionBreakdown = Partial<Record<RecontactExclusionReason, number>>;

export type SearchCampaignRecipientsInput = {
  campaignId: string;
  engagementStatus?: string;
  limit?: number;
  cursor?: string;
};

export type SearchCampaignRecipientsResult = {
  campaignId: string;
  campaignName: string;
  campaignStatus: string;
  originalListId: string | null;
  originalListName: string;
  truncated: boolean;
  stats: RecontactRecipientStats;
  exclusionBreakdown: RecontactExclusionBreakdown;
  items: RecontactRecipientRow[];
  nextCursor?: string;
};

export type CreateRecontactListInput = {
  campaignId: string;
  filter?: string;
  name?: string;
  idempotencyKey: string;
};

export type CreateRecontactListResult = {
  listId: string;
  listName: string;
  sourceCampaignId: string;
  sourceCampaignName: string;
  filter: typeof RECONTACT_FILTER;
  totalCandidates: number;
  added: number;
  excluded: number;
  exclusionBreakdown: RecontactExclusionBreakdown;
  reused: boolean;
  originalListId: string | null;
};

export type RecontactSendRecord = {
  id: string;
  campaignId?: unknown;
  contactId?: unknown;
  email?: unknown;
  name?: unknown;
  company?: unknown;
  country?: unknown;
  status?: unknown;
  testSend?: unknown;
  sentAt?: unknown;
  deliveredAt?: unknown;
  openedAt?: unknown;
  clickedAt?: unknown;
  repliedAt?: unknown;
  bouncedAt?: unknown;
  lastError?: unknown;
  createdAt?: unknown;
};

export type RecontactContactRecord = {
  id: string;
  email?: unknown;
  name?: unknown;
  company?: unknown;
  title?: unknown;
  country?: unknown;
  countryCode?: unknown;
  stage?: unknown;
  listIds?: unknown;
  doNotContact?: unknown;
  unsubscribed?: unknown;
  bounced?: unknown;
  deletedAt?: unknown;
  lastUnsubscribedAt?: unknown;
  linkedinStatus?: unknown;
};

export type RecontactCampaignRecord = {
  id: string;
  name?: unknown;
  status?: unknown;
  listId?: unknown;
  listName?: unknown;
  country?: unknown;
};

export type RecontactListRecord = {
  id: string;
  name: string;
  country?: string;
  contactCount?: number;
  sourceCampaignId?: string | null;
  sourceCampaignName?: string | null;
  recontactFilter?: string | null;
  recontact?: {
    filter?: string;
    sequence?: number;
    idempotencyKey?: string;
    sourceCampaignId?: string;
    sourceCampaignName?: string;
    evaluated?: number;
    added?: number;
    excluded?: number;
    exclusionBreakdown?: RecontactExclusionBreakdown;
  } | null;
  idempotencyKey?: string | null;
  notes?: string | null;
};

export type RecontactStore = {
  getCampaign(campaignId: string): Promise<RecontactCampaignRecord | null>;
  listSends(campaignId: string): Promise<{ sends: RecontactSendRecord[]; truncated: boolean }>;
  getContacts(contactIds: string[]): Promise<Map<string, RecontactContactRecord>>;
  listRecontactLists(campaignId: string): Promise<RecontactListRecord[]>;
  findRecontactListByIdempotency(campaignId: string, idempotencyKey: string): Promise<RecontactListRecord | null>;
  createList(input: {
    name: string;
    country: MarketingCountryCode | "all";
    sourceCampaignId: string;
    sourceCampaignName: string;
    sequence: number;
    idempotencyKey: string;
    notes: string;
    evaluated: number;
    added: number;
    excluded: number;
    exclusionBreakdown: RecontactExclusionBreakdown;
    originalListId: string | null;
  }): Promise<{ id: string; name: string }>;
  addContactsToList(listId: string, contactIds: string[]): Promise<{ added: number }>;
};

function asText(value: unknown): string {
  return String(value ?? "").trim();
}

function asTs(value: unknown): string | null {
  const text = asText(value);
  return text || null;
}

function earliestTs(...values: unknown[]): string | null {
  const stamps = values.map(asTs).filter((v): v is string => Boolean(v)).sort();
  return stamps[0] || null;
}

export function isRecontactEngagementStatus(value: string): value is RecontactEngagementStatus {
  return (RECONTACT_ENGAGEMENT_STATUSES as readonly string[]).includes(value);
}

export function parseRecontactEngagementStatus(value: string | null | undefined): RecontactEngagementStatus {
  const key = asText(value) || "all";
  return isRecontactEngagementStatus(key) ? key : "all";
}

export function engagementFlagsFromSend(send: RecontactSendRecord): RecontactEngagementFlags {
  const status = asText(send.status);
  const sent =
    Boolean(asTs(send.sentAt)) ||
    status === "sent" ||
    status === "delivered" ||
    status === "opened" ||
    status === "clicked" ||
    status === "replied";
  return {
    sent,
    opened: Boolean(asTs(send.openedAt)),
    clicked: Boolean(asTs(send.clickedAt)),
    replied: Boolean(asTs(send.repliedAt)),
    bounced: status === "bounced" || Boolean(asTs(send.bouncedAt)),
    unsubscribed: status === "unsubscribed",
    failed: status === "failed",
  };
}

export function mergeSendsForContact(sends: RecontactSendRecord[]): RecontactSendRecord {
  if (sends.length === 1) return sends[0];
  const flags = sends.map(engagementFlagsFromSend);
  const first = sends[0];
  const pickedStatus = sends.find((s) => asText(s.status) === "unsubscribed")
    || sends.find((s) => asText(s.status) === "bounced")
    || sends.find((s) => asText(s.status) === "failed")
    || sends.find((s) => asTs(s.repliedAt))
    || sends.find((s) => asTs(s.clickedAt))
    || sends.find((s) => asTs(s.openedAt))
    || first;
  return {
    ...first,
    status: pickedStatus.status,
    sentAt: earliestTs(...sends.map((s) => s.sentAt)),
    deliveredAt: earliestTs(...sends.map((s) => s.deliveredAt)),
    openedAt: flags.some((f) => f.opened) ? earliestTs(...sends.map((s) => s.openedAt)) : null,
    clickedAt: flags.some((f) => f.clicked) ? earliestTs(...sends.map((s) => s.clickedAt)) : null,
    repliedAt: flags.some((f) => f.replied) ? earliestTs(...sends.map((s) => s.repliedAt)) : null,
    bouncedAt: flags.some((f) => f.bounced) ? earliestTs(...sends.map((s) => s.bouncedAt)) : null,
    lastError: sends.map((s) => asText(s.lastError)).find(Boolean) || first.lastError,
  };
}

function contactIsDoNotContact(contact: RecontactContactRecord | undefined): boolean {
  if (!contact) return false;
  return contact.doNotContact === true || asText(contact.linkedinStatus) === "do_not_contact";
}

function contactUnsubscribed(contact: RecontactContactRecord | undefined, sendUnsubscribed: boolean): boolean {
  if (sendUnsubscribed) return true;
  if (!contact) return false;
  return contact.unsubscribed === true || asText(contact.stage) === "unsubscribed";
}

export function recipientMatchesEngagement(
  flags: RecontactEngagementFlags,
  status: RecontactEngagementStatus,
): boolean {
  if (status === "all") return true;
  if (status === "opened") return flags.opened;
  if (status === "not_opened") return flags.sent && !flags.opened;
  if (status === "clicked") return flags.clicked;
  if (status === "replied") return flags.replied;
  if (status === "bounced") return flags.bounced;
  if (status === "unsubscribed") return flags.unsubscribed;
  if (status === "failed") return flags.failed;
  return true;
}

export function classifyRecontactRecipient(input: {
  campaignId: string;
  send: RecontactSendRecord;
  contact?: RecontactContactRecord | null;
  alreadyRecontactedListIds?: Set<string>;
}): RecontactRecipientRow {
  const send = input.send;
  const contact = input.contact || undefined;
  const flags = engagementFlagsFromSend(send);
  const email = normalizeEmail(asText(contact?.email) || asText(send.email));
  const listIds = Array.isArray(contact?.listIds) ? contact!.listIds.map(String) : [];
  const already =
    Boolean(input.alreadyRecontactedListIds?.size) &&
    listIds.some((id) => input.alreadyRecontactedListIds!.has(id));

  let exclusionReason: RecontactExclusionReason | null = null;
  if (!contact || asTs(contact.deletedAt)) exclusionReason = "contact_deleted";
  else if (!isValidEmail(email)) exclusionReason = "invalid_email";
  else if (contactIsDoNotContact(contact)) exclusionReason = "do_not_contact";
  else if (contactUnsubscribed(contact, flags.unsubscribed)) exclusionReason = "unsubscribed";
  else if (flags.bounced || contact.bounced === true || asText(contact.stage) === "bounced") exclusionReason = "bounced";
  else if (flags.failed) exclusionReason = "failed";
  else if (flags.opened) exclusionReason = "opened";
  else if (flags.clicked) exclusionReason = "clicked";
  else if (flags.replied) exclusionReason = "replied";
  else if (!flags.sent) exclusionReason = "not_sent";
  else if (!isSendableStage(asText(contact.stage) || "new")) exclusionReason = "not_eligible";
  else if (already) exclusionReason = "already_recontacted";

  const eligibleForRecontact = flags.sent && !flags.opened && exclusionReason === null;

  return {
    contactId: asText(send.contactId) || contact?.id || send.id,
    campaignId: input.campaignId,
    name: asText(contact?.name) || asText(send.name),
    email,
    company: asText(contact?.company) || asText(send.company),
    title: asText(contact?.title),
    countryCode: (
      asText(contact?.countryCode) ||
      asText(contact?.country) ||
      asText(send.country)
    ).toUpperCase(),
    sentAt: asTs(send.sentAt),
    openedAt: asTs(send.openedAt),
    clickedAt: asTs(send.clickedAt),
    repliedAt: asTs(send.repliedAt),
    bouncedAt: asTs(send.bouncedAt),
    unsubscribedAt: asTs(contact?.lastUnsubscribedAt),
    failedAt: null,
    eligibleForRecontact,
    exclusionReason: eligibleForRecontact ? null : exclusionReason || "not_eligible",
    ...flags,
    unsubscribed: contactUnsubscribed(contact, flags.unsubscribed),
    bounced: flags.bounced || contact?.bounced === true || asText(contact?.stage) === "bounced",
    failed: flags.failed,
  };
}

export function emptyRecontactStats(): RecontactRecipientStats {
  return {
    total: 0,
    sent: 0,
    opened: 0,
    clicked: 0,
    replied: 0,
    notOpened: 0,
    unsubscribed: 0,
    bounced: 0,
    failed: 0,
    eligibleForRecontact: 0,
    excluded: 0,
  };
}

export function summarizeRecontactRows(rows: RecontactRecipientRow[]): {
  stats: RecontactRecipientStats;
  exclusionBreakdown: RecontactExclusionBreakdown;
} {
  const stats = emptyRecontactStats();
  const exclusionBreakdown: RecontactExclusionBreakdown = {};
  stats.total = rows.length;
  for (const row of rows) {
    if (row.sent) stats.sent += 1;
    if (row.opened) stats.opened += 1;
    if (row.clicked) stats.clicked += 1;
    if (row.replied) stats.replied += 1;
    if (row.sent && !row.opened) stats.notOpened += 1;
    if (row.unsubscribed) stats.unsubscribed += 1;
    if (row.bounced) stats.bounced += 1;
    if (row.failed) stats.failed += 1;
    if (row.sent && !row.opened) {
      if (row.eligibleForRecontact) stats.eligibleForRecontact += 1;
      else {
        stats.excluded += 1;
        const reason = row.exclusionReason || "not_eligible";
        exclusionBreakdown[reason] = (exclusionBreakdown[reason] || 0) + 1;
      }
    }
  }
  return { stats, exclusionBreakdown };
}

export function sortRecontactRows(rows: RecontactRecipientRow[]): RecontactRecipientRow[] {
  return [...rows].sort((a, b) => {
    const email = a.email.localeCompare(b.email, "es");
    if (email) return email;
    return a.contactId.localeCompare(b.contactId);
  });
}

export function pageRecontactRows(
  rows: RecontactRecipientRow[],
  limit: number,
  cursor?: string,
): { items: RecontactRecipientRow[]; nextCursor?: string } {
  const decoded = decodeMarketingCursor(cursor);
  let start = 0;
  if (decoded) {
    const idx = rows.findIndex((row) => row.contactId === decoded.id);
    start = idx >= 0 ? idx + 1 : 0;
  }
  const slice = rows.slice(start, start + limit + 1);
  const extra = slice.length > limit;
  const items = extra ? slice.slice(0, limit) : slice;
  const last = items[items.length - 1];
  return {
    items,
    nextCursor: extra && last ? encodeMarketingCursor({ t: last.email, id: last.contactId }) : undefined,
  };
}

export function defaultRecontactListName(sequence: number, campaignName: string): string {
  const seq = String(Math.max(1, sequence)).padStart(2, "0");
  const prefix = `RECONTACTO ${seq} | No apertura | `;
  const rest = asText(campaignName) || "Campaña";
  return `${prefix}${rest}`.slice(0, 160);
}

export function nextRecontactSequence(lists: RecontactListRecord[]): number {
  let max = 0;
  for (const list of lists) {
    const seq = Number(list.recontact?.sequence || 0);
    if (Number.isFinite(seq) && seq > max) max = seq;
    const match = /^RECONTACTO\s+(\d+)/i.exec(list.name || "");
    if (match) max = Math.max(max, Number(match[1]) || 0);
  }
  return max + 1;
}

export function defaultRecontactIdempotencyKey(campaignId: string): string {
  return `recontact:${campaignId}:not_opened`;
}

function recontactListNotes(input: {
  sourceCampaignId: string;
  sourceCampaignName: string;
  createdAt: string;
  evaluated: number;
  added: number;
  excluded: number;
  exclusionBreakdown: RecontactExclusionBreakdown;
}): string {
  const reasons = Object.entries(input.exclusionBreakdown)
    .filter(([, n]) => n)
    .map(([reason, n]) => `${reason}: ${n}`)
    .join(", ");
  return [
    `Recontacto desde campaña «${input.sourceCampaignName}» (${input.sourceCampaignId}).`,
    "Filtro: not_opened.",
    `Creada: ${input.createdAt}.`,
    `Evaluados: ${input.evaluated}. Incorporados: ${input.added}. Excluidos: ${input.excluded}.`,
    reasons ? `Exclusiones: ${reasons}.` : "Sin exclusiones adicionales.",
    "Sin apertura registrada no implica que el mensaje no haya sido leído.",
  ].join(" ");
}

export function buildRecontactRows(input: {
  campaignId: string;
  sends: RecontactSendRecord[];
  contacts: Map<string, RecontactContactRecord>;
  alreadyRecontactedListIds: Set<string>;
}): RecontactRecipientRow[] {
  const byContact = new Map<string, RecontactSendRecord[]>();
  for (const send of input.sends) {
    if (send.testSend) continue;
    const contactId = asText(send.contactId);
    if (!contactId) continue;
    const list = byContact.get(contactId) || [];
    list.push(send);
    byContact.set(contactId, list);
  }
  const rows: RecontactRecipientRow[] = [];
  for (const [contactId, sends] of byContact) {
    rows.push(
      classifyRecontactRecipient({
        campaignId: input.campaignId,
        send: mergeSendsForContact(sends),
        contact: input.contacts.get(contactId) || null,
        alreadyRecontactedListIds: input.alreadyRecontactedListIds,
      }),
    );
  }
  return sortRecontactRows(rows);
}

async function loadClassifiedRows(
  store: RecontactStore,
  campaignId: string,
): Promise<{
  campaign: RecontactCampaignRecord;
  rows: RecontactRecipientRow[];
  truncated: boolean;
  recontactLists: RecontactListRecord[];
}> {
  const campaign = await store.getCampaign(campaignId);
  if (!campaign) throw new MarketingNotFoundError("Campaña", campaignId);
  const [{ sends, truncated }, recontactLists] = await Promise.all([
    store.listSends(campaignId),
    store.listRecontactLists(campaignId),
  ]);
  const contactIds = [...new Set(sends.map((s) => asText(s.contactId)).filter(Boolean))];
  const contacts = await store.getContacts(contactIds);
  const alreadyRecontactedListIds = new Set(recontactLists.map((l) => l.id));
  return {
    campaign,
    truncated,
    recontactLists,
    rows: buildRecontactRows({ campaignId, sends, contacts, alreadyRecontactedListIds }),
  };
}

export async function searchCampaignRecipients(
  store: RecontactStore,
  input: SearchCampaignRecipientsInput,
): Promise<SearchCampaignRecipientsResult> {
  const loaded = await loadClassifiedRows(store, input.campaignId);
  const engagementStatus = parseRecontactEngagementStatus(input.engagementStatus);
  const { stats, exclusionBreakdown } = summarizeRecontactRows(loaded.rows);
  const filtered = loaded.rows.filter((row) => recipientMatchesEngagement(row, engagementStatus));
  const page = pageRecontactRows(
    filtered,
    clampMarketingLimit(input.limit, 20, 100),
    input.cursor,
  );
  return {
    campaignId: loaded.campaign.id,
    campaignName: asText(loaded.campaign.name),
    campaignStatus: asText(loaded.campaign.status),
    originalListId: asText(loaded.campaign.listId) || null,
    originalListName: asText(loaded.campaign.listName),
    truncated: loaded.truncated,
    stats,
    exclusionBreakdown,
    items: page.items,
    nextCursor: page.nextCursor,
  };
}

export async function createRecontactListFromCampaign(
  store: RecontactStore,
  input: CreateRecontactListInput,
): Promise<CreateRecontactListResult> {
  const filter = asText(input.filter) || RECONTACT_FILTER;
  if (filter !== RECONTACT_FILTER) {
    throw new MarketingValidationError("Solo se puede crear una lista de recontacto con filtro not_opened.");
  }
  const idempotencyKey = asText(input.idempotencyKey) || defaultRecontactIdempotencyKey(input.campaignId);
  const existing = await store.findRecontactListByIdempotency(input.campaignId, idempotencyKey);
  if (existing) {
    const campaign = await store.getCampaign(input.campaignId);
    return {
      listId: existing.id,
      listName: existing.name,
      sourceCampaignId: input.campaignId,
      sourceCampaignName:
        asText(existing.sourceCampaignName) ||
        asText(existing.recontact?.sourceCampaignName) ||
        asText(campaign?.name),
      filter: RECONTACT_FILTER,
      totalCandidates: existing.recontact?.evaluated || existing.contactCount || 0,
      added: existing.recontact?.added ?? existing.contactCount ?? 0,
      excluded: existing.recontact?.excluded || 0,
      exclusionBreakdown: existing.recontact?.exclusionBreakdown || {},
      reused: true,
      originalListId: asText(campaign?.listId) || null,
    };
  }

  const loaded = await loadClassifiedRows(store, input.campaignId);
  const candidates = loaded.rows.filter((row) => row.sent && !row.opened);
  const eligible = candidates.filter((row) => row.eligibleForRecontact);
  const { exclusionBreakdown } = summarizeRecontactRows(loaded.rows);
  if (eligible.length === 0) {
    throw new MarketingValidationError(
      "No hay destinatarios elegibles para recontacto. El recuento no se infiere de enviados menos aperturas: se leyeron los envíos individuales y ninguno pasó las exclusiones.",
    );
  }

  const sequence = nextRecontactSequence(loaded.recontactLists);
  const campaignName = asText(loaded.campaign.name);
  const listName = (asText(input.name) || defaultRecontactListName(sequence, campaignName))
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
  const countryRaw = asText(loaded.campaign.country).toUpperCase();
  const country: MarketingCountryCode | "all" =
    countryRaw === "ALL" || !isMarketingCountryCode(countryRaw) ? "all" : countryRaw;
  const createdAt = new Date().toISOString();
  const notes = recontactListNotes({
    sourceCampaignId: loaded.campaign.id,
    sourceCampaignName: campaignName,
    createdAt,
    evaluated: candidates.length,
    added: eligible.length,
    excluded: candidates.length - eligible.length,
    exclusionBreakdown,
  });
  const originalListId = asText(loaded.campaign.listId) || null;
  const created = await store.createList({
    name: listName.slice(0, 160),
    country,
    sourceCampaignId: loaded.campaign.id,
    sourceCampaignName: campaignName,
    sequence,
    idempotencyKey,
    notes,
    evaluated: candidates.length,
    added: eligible.length,
    excluded: candidates.length - eligible.length,
    exclusionBreakdown,
    originalListId,
  });
  const added = await store.addContactsToList(
    created.id,
    eligible.map((row) => row.contactId),
  );
  return {
    listId: created.id,
    listName: created.name,
    sourceCampaignId: loaded.campaign.id,
    sourceCampaignName: campaignName,
    filter: RECONTACT_FILTER,
    totalCandidates: candidates.length,
    added: added.added,
    excluded: candidates.length - eligible.length,
    exclusionBreakdown,
    reused: false,
    originalListId,
  };
}

type MemoryList = RecontactListRecord & {
  originalListId?: string | null;
};

export type MemoryRecontactSeed = {
  campaigns?: RecontactCampaignRecord[];
  sends?: RecontactSendRecord[];
  contacts?: RecontactContactRecord[];
  lists?: MemoryList[];
  originalListMembership?: Map<string, string[]>;
};

export type MemoryRecontactStore = RecontactStore & {
  snapshot(): {
    campaigns: RecontactCampaignRecord[];
    sends: RecontactSendRecord[];
    contacts: RecontactContactRecord[];
    lists: MemoryList[];
    writes: string[];
  };
};

export function createMemoryRecontactStore(seed: MemoryRecontactSeed = {}): MemoryRecontactStore {
  const campaigns = new Map((seed.campaigns || []).map((c) => [c.id, { ...c }]));
  const sends = (seed.sends || []).map((s) => ({ ...s }));
  const contacts = new Map(
    (seed.contacts || []).map((c) => [
      c.id,
      { ...c, listIds: Array.isArray(c.listIds) ? [...c.listIds] : [] },
    ]),
  );
  const lists = [...(seed.lists || [])];
  const writes: string[] = [];
  let listSeq = lists.length;

  return {
    async getCampaign(campaignId) {
      return campaigns.get(campaignId) || null;
    },
    async listSends(campaignId) {
      const rows = sends.filter((s) => asText(s.campaignId) === campaignId);
      return { sends: rows.slice(0, RECONTACT_SEND_SCAN_LIMIT), truncated: rows.length > RECONTACT_SEND_SCAN_LIMIT };
    },
    async getContacts(contactIds) {
      const out = new Map<string, RecontactContactRecord>();
      for (const id of contactIds) {
        const row = contacts.get(id);
        if (row) out.set(id, row);
      }
      return out;
    },
    async listRecontactLists(campaignId) {
      return lists.filter((l) => l.sourceCampaignId === campaignId || l.recontact?.sourceCampaignId === campaignId);
    },
    async findRecontactListByIdempotency(campaignId, idempotencyKey) {
      return (
        lists.find(
          (l) =>
            (l.sourceCampaignId === campaignId || l.recontact?.sourceCampaignId === campaignId) &&
            (l.idempotencyKey === idempotencyKey || l.recontact?.idempotencyKey === idempotencyKey),
        ) || null
      );
    },
    async createList(input) {
      listSeq += 1;
      const row: MemoryList = {
        id: `relist_${listSeq}`,
        name: input.name,
        country: input.country,
        contactCount: 0,
        sourceCampaignId: input.sourceCampaignId,
        recontactFilter: RECONTACT_FILTER,
        idempotencyKey: input.idempotencyKey,
        notes: input.notes,
        originalListId: input.originalListId,
        sourceCampaignName: input.sourceCampaignName,
        recontact: {
          filter: RECONTACT_FILTER,
          sequence: input.sequence,
          idempotencyKey: input.idempotencyKey,
          sourceCampaignId: input.sourceCampaignId,
          sourceCampaignName: input.sourceCampaignName,
          evaluated: input.evaluated,
          added: input.added,
          excluded: input.excluded,
          exclusionBreakdown: input.exclusionBreakdown,
        },
      };
      lists.push(row);
      writes.push(`list.create:${row.id}`);
      return { id: row.id, name: row.name };
    },
    async addContactsToList(listId, contactIds) {
      let added = 0;
      for (const contactId of contactIds) {
        const contact = contacts.get(contactId);
        if (!contact) continue;
        const ids = Array.isArray(contact.listIds) ? contact.listIds.map(String) : [];
        if (!ids.includes(listId)) {
          contact.listIds = [...ids, listId];
          added += 1;
        }
        writes.push(`contact.listUnion:${contactId}:${listId}`);
      }
      const list = lists.find((l) => l.id === listId);
      if (list) list.contactCount = (list.contactCount || 0) + added;
      writes.push(`list.bump:${listId}:${added}`);
      return { added };
    },
    snapshot() {
      return {
        campaigns: [...campaigns.values()].map((c) => ({ ...c })),
        sends: sends.map((s) => ({ ...s })),
        contacts: [...contacts.values()].map((c) => ({
          ...c,
          listIds: Array.isArray(c.listIds) ? [...c.listIds] : [],
        })),
        lists: lists.map((l) => ({ ...l })),
        writes: [...writes],
      };
    },
  };
}

export function createLiveRecontactStore(): RecontactStore {
  return {
    async getCampaign(campaignId) {
      const snap = await getAdminDb().collection(MARKETING_CAMPAIGNS).doc(campaignId).get();
      if (!snap.exists) return null;
      return serializeAdminDoc(snap.id, snap.data() || {}) as RecontactCampaignRecord;
    },
    async listSends(campaignId) {
      const snap = await getAdminDb()
        .collection(MARKETING_SENDS)
        .where("campaignId", "==", campaignId)
        .limit(RECONTACT_SEND_SCAN_LIMIT)
        .get();
      const sends = snap.docs
        .map((d) => serializeAdminDoc(d.id, d.data()) as RecontactSendRecord)
        .filter((row) => !row.testSend);
      return { sends, truncated: snap.size >= RECONTACT_SEND_SCAN_LIMIT };
    },
    async getContacts(contactIds) {
      const db = getAdminDb();
      const unique = [...new Set(contactIds.filter(Boolean))];
      const out = new Map<string, RecontactContactRecord>();
      if (unique.length === 0) return out;
      for (let i = 0; i < unique.length; i += CONTACT_GET_CHUNK) {
        const chunk = unique.slice(i, i + CONTACT_GET_CHUNK);
        const snaps = await db.getAll(...chunk.map((id) => db.collection(MARKETING_CONTACTS).doc(id)));
        for (const snap of snaps) {
          if (!snap.exists) continue;
          out.set(snap.id, serializeAdminDoc(snap.id, snap.data() || {}) as RecontactContactRecord);
        }
      }
      return out;
    },
    async listRecontactLists(campaignId) {
      const snap = await getAdminDb()
        .collection(MARKETING_LISTS)
        .where("sourceCampaignId", "==", campaignId)
        .limit(100)
        .get();
      return snap.docs.map((d) => {
        const data = serializeAdminDoc(d.id, d.data() || {});
        return {
          id: d.id,
          name: asText(data.name),
          country: asText(data.country),
          contactCount: Number(data.contactCount || 0),
          sourceCampaignId: asText(data.sourceCampaignId) || null,
          sourceCampaignName: asText(data.sourceCampaignName) || null,
          recontactFilter: asText(data.recontactFilter) || null,
          recontact: (data.recontact as RecontactListRecord["recontact"]) || null,
          idempotencyKey: asText(data.idempotencyKey) || null,
          notes: asText(data.notes) || null,
        };
      });
    },
    async findRecontactListByIdempotency(campaignId, idempotencyKey) {
      const lists = await this.listRecontactLists(campaignId);
      return (
        lists.find(
          (l) => l.idempotencyKey === idempotencyKey || l.recontact?.idempotencyKey === idempotencyKey,
        ) || null
      );
    },
    async createList(input) {
      const db = getAdminDb();
      const ref = db.collection(MARKETING_LISTS).doc();
      const name = input.name.slice(0, 160);
      await ref.set({
        name,
        nameKey: listNameKey(name),
        country: input.country,
        contactCount: 0,
        source: "manual",
        sourceCampaignId: input.sourceCampaignId,
        sourceCampaignName: input.sourceCampaignName,
        recontactFilter: RECONTACT_FILTER,
        originalListId: input.originalListId,
        idempotencyKey: input.idempotencyKey,
        notes: input.notes.slice(0, 4000),
        recontact: {
          sourceCampaignId: input.sourceCampaignId,
          sourceCampaignName: input.sourceCampaignName,
          filter: RECONTACT_FILTER,
          sequence: input.sequence,
          idempotencyKey: input.idempotencyKey,
          createdAt: new Date().toISOString(),
          evaluated: input.evaluated,
          added: input.added,
          excluded: input.excluded,
          exclusionBreakdown: input.exclusionBreakdown,
          originalListId: input.originalListId,
        },
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      return { id: ref.id, name };
    },
    async addContactsToList(listId, contactIds) {
      const db = getAdminDb();
      let added = 0;
      let batch = db.batch();
      let ops = 0;
      const flush = async () => {
        if (!ops) return;
        await batch.commit();
        batch = db.batch();
        ops = 0;
      };
      for (const contactId of contactIds) {
        const ref = db.collection(MARKETING_CONTACTS).doc(contactId);
        const snap = await ref.get();
        if (!snap.exists) continue;
        const already =
          Array.isArray(snap.data()?.listIds) && snap.data()!.listIds.map(String).includes(listId);
        batch.set(
          ref,
          { listIds: FieldValue.arrayUnion(listId), updatedAt: FieldValue.serverTimestamp() },
          { merge: true },
        );
        if (!already) added += 1;
        ops += 1;
        if (ops >= LIST_WRITE_CHUNK) await flush();
      }
      await flush();
      if (added > 0) await bumpListCount(listId, added);
      return { added };
    },
  };
}

export function liveRecontactStore(): RecontactStore {
  return createLiveRecontactStore();
}
