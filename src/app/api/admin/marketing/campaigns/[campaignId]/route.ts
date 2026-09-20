import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { assertAdminSession } from "@/lib/assert-admin-session";
import { getAdminDb } from "@/lib/firebase-admin";
import { audienceForCampaign, resolveListLabel } from "@/lib/marketing/audience";
import { MARKETING_CAMPAIGNS, MARKETING_SENDS } from "@/lib/marketing/collections";
import { persistCampaignEmail, parseCampaignEmailContent } from "@/lib/marketing/campaign-email";
import { campaignEmailContentSchema, campaignHtmlBodySchema } from "@/lib/marketing/campaign-email-input";
import { serializeAdminDoc } from "@/lib/marketing/events";
import { namedRecipientSource } from "@/lib/marketing/lists";

const patchSchema = z.object({
  name: z.string().min(2).max(160).optional(),
  subject: z.string().min(2).max(200).optional(),
  htmlBody: campaignHtmlBodySchema.optional(),
  textBody: z.string().max(20_000).optional(),
  emailContent: campaignEmailContentSchema.optional(),
  listId: z.string().min(1).max(80).optional(),
  status: z.enum(["paused", "cancelled", "sending"]).optional(),
  archived: z.boolean().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> },
) {
  const denied = assertAdminSession(request);
  if (denied) return denied;
  const { campaignId } = await params;
  try {
    const db = getAdminDb();
    const snap = await db.collection(MARKETING_CAMPAIGNS).doc(campaignId).get();
    if (!snap.exists) return NextResponse.json({ error: "No encontrada" }, { status: 404 });
    const sendsSnap = await db.collection(MARKETING_SENDS).where("campaignId", "==", campaignId).limit(500).get();
    const sends = sendsSnap.docs
      .map((d) => serializeAdminDoc(d.id, d.data()))
      .filter((row) => !row.testSend)
      .sort((a, b) => String(b.sentAt || b.createdAt || "").localeCompare(String(a.sentAt || a.createdAt || "")));
    const campaign = serializeAdminDoc(snap.id, snap.data() || {});
    const audience =
      String(campaign.status || "") === "draft"
        ? await audienceForCampaign(campaign)
        : null;
    return NextResponse.json({
      campaign,
      sends,
      audience,
    });
  } catch (e) {
    console.error("GET marketing campaign", e);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> },
) {
  const denied = assertAdminSession(request);
  if (denied) return denied;
  const { campaignId } = await params;
  try {
    const parsed = patchSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const db = getAdminDb();
    const ref = db.collection(MARKETING_CAMPAIGNS).doc(campaignId);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ error: "No encontrada" }, { status: 404 });
    const current = String(snap.data()?.status || "draft");
    const updates: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
    const d = parsed.data;
    if (d.name) updates.name = d.name.trim();
    if (d.subject) updates.subject = d.subject.trim();
    if (d.emailContent || d.htmlBody) {
      if (current !== "draft") {
        return NextResponse.json({ error: "Solo se puede editar el contenido de un borrador." }, { status: 409 });
      }
      const currentData = snap.data() || {};
      const currentContent = parseCampaignEmailContent(currentData.emailContent);
      const snapshot = persistCampaignEmail({
        ...(currentContent || {}),
        ...(d.emailContent || {}),
        htmlBody: d.htmlBody || String(currentData.htmlBody || ""),
        name: String(d.name || currentData.name || ""),
        subject: String(d.subject || currentData.subject || ""),
        title: d.emailContent?.title || currentContent?.title || String(d.subject || currentData.subject || ""),
        campaignName: d.emailContent?.campaignName || currentContent?.campaignName || String(d.name || currentData.name || ""),
      });
      updates.htmlBody = snapshot.htmlBody;
      updates.textBody = snapshot.textBody;
      updates.emailContent = snapshot.emailContent;
      updates.templateId = snapshot.templateId;
      updates.templateVersion = snapshot.templateVersion;
      updates.htmlSnapshotAt = FieldValue.serverTimestamp();
    } else if (d.textBody !== undefined) {
      updates.textBody = d.textBody;
    }
    if (d.listId) {
      if (current !== "draft" && current !== "paused") {
        return NextResponse.json({ error: "Solo se puede cambiar la lista en un borrador." }, { status: 409 });
      }
      const list = await resolveListLabel(d.listId);
      if (namedRecipientSource({ listId: list.listId }).kind !== "list") {
        return NextResponse.json({ error: "Cargá una lista nominada (CSV)." }, { status: 400 });
      }
      updates.listId = list.listId;
      updates.listName = list.listName;
      updates.country = list.country;
      if (list.industryId) updates.industryId = list.industryId;
      if (list.useCaseId) updates.useCaseId = list.useCaseId;
      if (list.useCaseIds?.length) updates.useCaseIds = list.useCaseIds;
    }
    if (d.status === "paused" && current === "sending") updates.status = "paused";
    if (d.status === "sending" && current === "paused") {
      if (snap.data()?.archivedAt) {
        return NextResponse.json({ error: "Restaurá la campaña para reanudar el envío." }, { status: 409 });
      }
      updates.status = "sending";
    }
    if (d.status === "cancelled" && current !== "sent") {
      updates.status = "cancelled";
      updates.completedAt = FieldValue.serverTimestamp();
    }
    if (d.archived === true) {
      updates.archivedAt = FieldValue.serverTimestamp();
      if (current === "sending") updates.status = "paused";
    }
    if (d.archived === false) updates.archivedAt = null;
    await ref.update(updates);
    const next = await ref.get();
    return NextResponse.json({ campaign: serializeAdminDoc(next.id, next.data() || {}) });
  } catch (e) {
    console.error("PATCH marketing campaign", e);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
