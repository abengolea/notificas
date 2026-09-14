import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { assertAdminSession } from "@/lib/assert-admin-session";
import { getAdminDb } from "@/lib/firebase-admin";
import { MARKETING_CAMPAIGNS, MARKETING_SENDS } from "@/lib/marketing/collections";
import { serializeAdminDoc } from "@/lib/marketing/events";

const patchSchema = z.object({
  name: z.string().min(2).max(160).optional(),
  subject: z.string().min(2).max(200).optional(),
  htmlBody: z.string().min(8).max(50_000).optional(),
  textBody: z.string().max(20_000).optional(),
  status: z.enum(["paused", "cancelled", "sending"]).optional(),
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
      .sort((a, b) => String(b.sentAt || b.createdAt || "").localeCompare(String(a.sentAt || a.createdAt || "")));
    return NextResponse.json({
      campaign: serializeAdminDoc(snap.id, snap.data() || {}),
      sends,
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
    if (d.htmlBody) updates.htmlBody = d.htmlBody;
    if (d.textBody !== undefined) updates.textBody = d.textBody;
    if (d.status === "paused" && current === "sending") updates.status = "paused";
    if (d.status === "sending" && current === "paused") updates.status = "sending";
    if (d.status === "cancelled" && current !== "sent") {
      updates.status = "cancelled";
      updates.completedAt = FieldValue.serverTimestamp();
    }
    await ref.update(updates);
    const next = await ref.get();
    return NextResponse.json({ campaign: serializeAdminDoc(next.id, next.data() || {}) });
  } catch (e) {
    console.error("PATCH marketing campaign", e);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
