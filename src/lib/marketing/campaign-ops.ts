import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { MARKETING_CAMPAIGNS, MARKETING_CONTACTS, MARKETING_SENDS } from "./collections";
import { serializeAdminDoc } from "./events";
import { emptyCampaignStats, marketingFromEmail, marketingFromName } from "./types";

const RETRY_SKIP_STAGES = new Set(["unsubscribed", "bounced", "not_interested"]);

export function copyCampaignName(name: string): string {
  const trimmed = String(name || "").trim() || "Campaña";
  if (/^copia de /i.test(trimmed)) return trimmed.slice(0, 160);
  return `Copia de ${trimmed}`.slice(0, 160);
}

export function isCampaignArchived(camp: { archivedAt?: unknown }): boolean {
  return Boolean(camp.archivedAt);
}

export function shouldSkipFailedRetry(stage: string): boolean {
  return RETRY_SKIP_STAGES.has(String(stage || "").trim());
}

export function copiedCampaignFields(
  source: Record<string, unknown>,
  sourceId: string,
): Record<string, unknown> {
  const includeStages = Array.isArray(source.includeStages)
    ? source.includeStages.map(String).filter(Boolean)
    : ["new"];
  const useCaseIds = Array.isArray(source.useCaseIds)
    ? source.useCaseIds.map(String).filter(Boolean)
    : source.useCaseId
      ? [String(source.useCaseId)]
      : [];
  const fields: Record<string, unknown> = {
    name: copyCampaignName(String(source.name || "")),
    country: source.country || "all",
    listId: source.listId || null,
    listName: source.listName || "",
    subject: source.subject || "",
    htmlBody: source.htmlBody || "",
    textBody: source.textBody || "",
    fromEmail: source.fromEmail || marketingFromEmail(),
    fromName: source.fromName || marketingFromName(),
    status: "draft",
    includeStages: includeStages.length ? includeStages : ["new"],
    contactCount: Number(source.contactCount) || 0,
    stats: emptyCampaignStats(),
    audienceKind: source.audienceKind || "list",
    industryId: source.industryId || null,
    useCaseId: source.useCaseId || useCaseIds[0] || null,
    useCaseIds,
    copiedFromId: sourceId,
    archivedAt: null,
    startedAt: null,
    completedAt: null,
  };
  if (source.workspaceId) fields.workspaceId = source.workspaceId;
  if (source.templateId) fields.templateId = source.templateId;
  if (source.templateVersion) fields.templateVersion = source.templateVersion;
  if (source.templateSnapshot) fields.templateSnapshot = source.templateSnapshot;
  if (Array.isArray(source.industryIds) && source.industryIds.length) fields.industryIds = source.industryIds;
  return fields;
}

export async function copyMarketingCampaign(campaignId: string): Promise<{ campaign: Record<string, unknown> }> {
  const db = getAdminDb();
  const snap = await db.collection(MARKETING_CAMPAIGNS).doc(campaignId).get();
  if (!snap.exists) throw Object.assign(new Error("Campaña no encontrada"), { status: 404 });
  const source = snap.data() || {};
  const ref = db.collection(MARKETING_CAMPAIGNS).doc();
  await ref.set({
    ...copiedCampaignFields(source, campaignId),
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  const next = await ref.get();
  return { campaign: serializeAdminDoc(next.id, next.data() || {}) };
}

export async function retryFailedCampaignSends(campaignId: string): Promise<{ retried: number; skipped: number }> {
  const db = getAdminDb();
  const campRef = db.collection(MARKETING_CAMPAIGNS).doc(campaignId);
  const campSnap = await campRef.get();
  if (!campSnap.exists) throw Object.assign(new Error("Campaña no encontrada"), { status: 404 });
  const camp = campSnap.data() || {};
  if (String(camp.status || "") === "draft") {
    throw Object.assign(new Error("Esta campaña todavía no se envió."), { status: 409 });
  }

  const failedSnap = await db
    .collection(MARKETING_SENDS)
    .where("campaignId", "==", campaignId)
    .where("status", "==", "failed")
    .limit(500)
    .get();

  let retried = 0;
  let skipped = 0;
  let batch = db.batch();
  let ops = 0;
  const flush = async () => {
    if (ops === 0) return;
    await batch.commit();
    batch = db.batch();
    ops = 0;
  };

  for (const doc of failedSnap.docs) {
    const send = doc.data();
    const contactId = String(send.contactId || "").trim();
    if (!contactId) {
      skipped += 1;
      continue;
    }
    const contactSnap = await db.collection(MARKETING_CONTACTS).doc(contactId).get();
    const stage = String(contactSnap.data()?.stage || "");
    if (shouldSkipFailedRetry(stage) || !String(send.email || "").trim()) {
      skipped += 1;
      continue;
    }
    batch.update(doc.ref, {
      status: "queued",
      lastError: null,
      resendEmailId: null,
      rfcMessageId: null,
      sentAt: null,
      deliveredAt: null,
      retryCount: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp(),
    });
    ops += 1;
    retried += 1;
    if (ops >= 400) await flush();
  }
  await flush();

  if (retried === 0) {
    return { retried: 0, skipped };
  }

  await campRef.update({
    status: "sending",
    archivedAt: null,
    completedAt: null,
    "stats.failed": FieldValue.increment(-retried),
    "stats.queued": FieldValue.increment(retried),
    updatedAt: FieldValue.serverTimestamp(),
  });

  return { retried, skipped };
}
