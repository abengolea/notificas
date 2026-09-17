import { Timestamp } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import {
  MARKETING_CAMPAIGNS,
  MARKETING_CONTACTS,
  MARKETING_EVENTS,
  MARKETING_SENDS,
} from "./collections";
import { nextStage, type MarketingStage } from "./stages";
import type { MarketingEventType, MarketingSendStatus } from "./types";

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

export function serializeAdminDoc(
  id: string,
  data: FirebaseFirestore.DocumentData,
): Record<string, unknown> {
  const serialized = serializeValue(data);
  const obj =
    serialized && typeof serialized === "object" && !Array.isArray(serialized)
      ? (serialized as Record<string, unknown>)
      : {};
  return { id, ...obj };
}

function serializeValue(v: unknown): unknown {
  if (v === null || v === undefined) return v ?? null;
  if (v instanceof Timestamp) return v.toDate().toISOString();
  if (typeof v === "object" && v !== null && "toDate" in v && typeof (v as Timestamp).toDate === "function") {
    try {
      return (v as Timestamp).toDate().toISOString();
    } catch {
      /* fall through */
    }
  }
  if (Array.isArray(v)) return v.map(serializeValue);
  if (typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      if (k.endsWith("Enc") || k === "refreshTokenEnc" || k === "accessTokenEnc") continue;
      out[k] = serializeValue(val);
    }
    return out;
  }
  return v;
}

const EVENT_TO_SEND: Partial<Record<MarketingEventType, MarketingSendStatus>> = {
  sent: "sent",
  delivered: "delivered",
  opened: "opened",
  clicked: "clicked",
  replied: "replied",
  bounced: "bounced",
  failed: "failed",
  unsubscribed: "unsubscribed",
};

const EVENT_TO_STAGE: Partial<Record<MarketingEventType, MarketingStage>> = {
  sent: "sent",
  opened: "opened",
  clicked: "clicked",
  replied: "replied",
  bounced: "bounced",
  unsubscribed: "unsubscribed",
};

export async function recordMarketingEvent(input: {
  sendId: string;
  campaignId: string;
  contactId: string;
  type: MarketingEventType;
  at?: string;
  meta?: Record<string, unknown>;
}): Promise<{ applied: boolean }> {
  const db = getAdminDb();
  const at = input.at || new Date().toISOString();
  const sendRef = db.collection(MARKETING_SENDS).doc(input.sendId);
  const contactRef = db.collection(MARKETING_CONTACTS).doc(input.contactId);
  const campaignRef = db.collection(MARKETING_CAMPAIGNS).doc(input.campaignId);
  const eventRef = db.collection(MARKETING_EVENTS).doc();

  let applied = false;
  await db.runTransaction(async (tx) => {
    const sendSnap = await tx.get(sendRef);
    if (!sendSnap.exists) return;
    const send = sendSnap.data() || {};
    const currentSendStatus = str(send.status);
    const nextSend = EVENT_TO_SEND[input.type];
    const sendUpdates: Record<string, unknown> = {};

    if (input.type === "delivered" && !str(send.deliveredAt)) {
      sendUpdates.deliveredAt = at;
    }
    if (input.type === "opened") {
      sendUpdates.openCount = FieldValue.increment(1);
      if (!str(send.openedAt)) sendUpdates.openedAt = at;
    }
    if (input.type === "clicked") {
      sendUpdates.clickCount = FieldValue.increment(1);
      if (!str(send.clickedAt)) sendUpdates.clickedAt = at;
    }
    if (input.type === "replied" && !str(send.repliedAt)) {
      sendUpdates.repliedAt = at;
      sendUpdates.gmailThreadId = str(input.meta?.gmailThreadId) || send.gmailThreadId || null;
      sendUpdates.gmailMessageId = str(input.meta?.gmailMessageId) || send.gmailMessageId || null;
      sendUpdates.replySnippet = str(input.meta?.snippet).slice(0, 280) || send.replySnippet || null;
    }
    if (input.type === "bounced" && !str(send.bouncedAt)) {
      sendUpdates.bouncedAt = at;
      sendUpdates.lastError = str(input.meta?.reason) || "bounced";
    }
    if (input.type === "failed") {
      sendUpdates.lastError = str(input.meta?.reason) || "failed";
    }
    if (input.type === "sent" && !str(send.sentAt)) {
      sendUpdates.sentAt = at;
    }

    if (nextSend && shouldAdvanceSend(currentSendStatus, nextSend)) {
      sendUpdates.status = nextSend;
    }

    const contactSnap = await tx.get(contactRef);
    const contactUpdates: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (contactSnap.exists) {
      const contact = contactSnap.data() || {};
      if (contact.stageManual === true && input.type !== "unsubscribed" && input.type !== "bounced") {
        /* keep manual stage */
      } else {
        const incomingStage = EVENT_TO_STAGE[input.type];
        if (incomingStage) {
          contactUpdates.stage = nextStage(str(contact.stage), incomingStage);
          if (incomingStage === "not_interested" || incomingStage === "unsubscribed") {
            contactUpdates.stageManual = incomingStage === "not_interested";
          }
        }
      }
      if (input.type === "sent") {
        contactUpdates.lastSentAt = at;
        contactUpdates.lastCampaignId = input.campaignId;
        contactUpdates.lastSendId = input.sendId;
      }
      if (input.type === "opened") contactUpdates.lastOpenedAt = at;
      if (input.type === "clicked") contactUpdates.lastClickedAt = at;
      if (input.type === "replied") contactUpdates.lastRepliedAt = at;
      if (input.type === "unsubscribed") contactUpdates.lastUnsubscribedAt = at;
    }

    const campaignSnap = await tx.get(campaignRef);
    const campaignUpdates: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (campaignSnap.exists) {
      if (input.type === "sent" && currentSendStatus === "queued") {
        campaignUpdates["stats.queued"] = FieldValue.increment(-1);
        campaignUpdates["stats.sent"] = FieldValue.increment(1);
      }
      if (input.type === "delivered" && !str(send.deliveredAt)) {
        campaignUpdates["stats.delivered"] = FieldValue.increment(1);
      }
      if (input.type === "opened" && !str(send.openedAt)) {
        campaignUpdates["stats.opened"] = FieldValue.increment(1);
      }
      if (input.type === "clicked" && !str(send.clickedAt)) {
        campaignUpdates["stats.clicked"] = FieldValue.increment(1);
      }
      if (input.type === "replied" && !str(send.repliedAt)) {
        campaignUpdates["stats.replied"] = FieldValue.increment(1);
      }
      if (input.type === "bounced" && currentSendStatus !== "bounced") {
        campaignUpdates["stats.bounced"] = FieldValue.increment(1);
        if (currentSendStatus === "queued") campaignUpdates["stats.queued"] = FieldValue.increment(-1);
      }
      if (input.type === "failed" && currentSendStatus === "queued") {
        campaignUpdates["stats.failed"] = FieldValue.increment(1);
        campaignUpdates["stats.queued"] = FieldValue.increment(-1);
      }
      if (input.type === "unsubscribed") {
        campaignUpdates["stats.unsubscribed"] = FieldValue.increment(1);
      }
    }

    tx.set(eventRef, {
      sendId: input.sendId,
      campaignId: input.campaignId,
      contactId: input.contactId,
      type: input.type,
      at,
      meta: input.meta || {},
      createdAt: FieldValue.serverTimestamp(),
    });
    if (Object.keys(sendUpdates).length) tx.update(sendRef, sendUpdates);
    if (contactSnap.exists) tx.update(contactRef, contactUpdates);
    if (campaignSnap.exists && Object.keys(campaignUpdates).length > 1) tx.update(campaignRef, campaignUpdates);
    applied = true;
  });

  return { applied };
}

function shouldAdvanceSend(current: string, incoming: MarketingSendStatus): boolean {
  const rank: Record<string, number> = {
    queued: 1,
    sent: 2,
    delivered: 3,
    opened: 4,
    clicked: 5,
    replied: 6,
    bounced: 80,
    failed: 80,
    unsubscribed: 90,
  };
  if (current === incoming) return false;
  if (current === "replied" && incoming !== "bounced") return false;
  return (rank[incoming] ?? 0) >= (rank[current] ?? 0);
}

export function parseResendTags(raw: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (!item || typeof item !== "object") continue;
      const rec = item as Record<string, unknown>;
      const name = str(rec.name);
      const value = str(rec.value);
      if (name && value) out[name] = value;
    }
    return out;
  }
  if (raw && typeof raw === "object") {
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      const value = str(v);
      if (k && value) out[k] = value;
    }
  }
  return out;
}

export function marketingEventFromResend(eventType: string): MarketingEventType | null {
  switch (eventType) {
    case "email.sent":
    case "email.delivered":
      return eventType === "email.delivered" ? "delivered" : "sent";
    case "email.opened":
      return "opened";
    case "email.clicked":
      return "clicked";
    case "email.bounced":
    case "email.failed":
    case "email.suppressed":
      return eventType === "email.bounced" ? "bounced" : "failed";
    case "email.complained":
      return "complained";
    default:
      return null;
  }
}

/** Marketing only tracks delivery/open (and CRM extras). Never anchors to Polygon. */
export function shouldApplyMarketingResendEvent(eventType: string): boolean {
  const type = marketingEventFromResend(eventType);
  return Boolean(type) && type !== "sent";
}

export async function applyMarketingResendEvent(input: {
  eventType: string;
  providerMessageId: string | null;
  tags: unknown;
  clickUrl?: string | null;
  occurredAt: string;
}): Promise<boolean> {
  if (!shouldApplyMarketingResendEvent(input.eventType)) return false;
  const type = marketingEventFromResend(input.eventType);
  if (!type) return false;
  const db = getAdminDb();
  const tags = parseResendTags(input.tags);
  let sendId = tags.marketing_send_id || "";
  let sendSnap: FirebaseFirestore.DocumentSnapshot | null = null;
  if (sendId) {
    sendSnap = await db.collection(MARKETING_SENDS).doc(sendId).get();
    if (!sendSnap.exists) sendSnap = null;
  }
  if (!sendSnap && input.providerMessageId) {
    const q = await db
      .collection(MARKETING_SENDS)
      .where("resendEmailId", "==", input.providerMessageId)
      .limit(1)
      .get();
    sendSnap = q.empty ? null : q.docs[0];
    sendId = sendSnap?.id || "";
  }
  if (!sendSnap || !sendId) return false;
  const data = sendSnap.data() || {};
  await recordMarketingEvent({
    sendId,
    campaignId: str(data.campaignId),
    contactId: str(data.contactId),
    type,
    at: input.occurredAt,
    meta: { source: "resend", clickUrl: input.clickUrl || null },
  });
  return true;
}
