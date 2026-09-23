import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { assertAdminSession } from "@/lib/assert-admin-session";
import { getAdminDb } from "@/lib/firebase-admin";
import { MARKETING_ACTIVITIES, MARKETING_CONTACTS, MARKETING_EVENTS, MARKETING_SENDS } from "@/lib/marketing/collections";
import { isMarketingCountryCode } from "@/lib/marketing/countries";
import { serializeAdminDoc } from "@/lib/marketing/events";
import { isMarketingStage } from "@/lib/marketing/stages";
import { normalizeLinkedInUrl } from "@/lib/marketing/normalizers";
import { getMarketingWorkspaceId } from "@/lib/marketing/workspace";

const patchSchema = z.object({
  name: z.string().max(200).optional(),
  company: z.string().max(200).optional(),
  companyId: z.string().max(80).nullable().optional(),
  title: z.string().max(200).optional(),
  country: z.string().min(2).max(2).optional(),
  notes: z.string().max(4000).optional(),
  stage: z.string().optional(),
  tags: z.array(z.string().max(40)).optional(),
  linkedinUrl: z.string().max(500).nullable().optional(),
  linkedinStatus: z.enum([
    "not_contacted", "connection_ready", "connection_sent", "connected", "message_ready",
    "message_sent", "follow_up_due", "follow_up_sent", "replied", "interested",
    "not_interested", "do_not_contact", "not_found",
  ]).optional(),
  linkedinLastContactAt: z.string().datetime().nullable().optional(),
  linkedinNextActionAt: z.string().datetime().nullable().optional(),
  linkedinNotes: z.string().max(8000).optional(),
  prospectingSource: z.enum(["clay", "linkedin", "web", "manual", "association", "other"]).optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ contactId: string }> },
) {
  const denied = assertAdminSession(request);
  if (denied) return denied;
  const { contactId } = await params;
  try {
    const db = getAdminDb();
    const workspaceId = getMarketingWorkspaceId();
    const snap = await db.collection(MARKETING_CONTACTS).doc(contactId).get();
    if (!snap.exists) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    if (String(snap.data()?.workspaceId || workspaceId) !== workspaceId) {
      return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    }
    const [sendsSnap, eventsSnap, activitiesSnap] = await Promise.all([
      db.collection(MARKETING_SENDS).where("contactId", "==", contactId).limit(50).get(),
      db.collection(MARKETING_EVENTS).where("contactId", "==", contactId).limit(80).get(),
      db.collection(MARKETING_ACTIVITIES)
        .where("workspaceId", "==", workspaceId)
        .where("contactId", "==", contactId)
        .orderBy("createdAt", "desc")
        .limit(80)
        .get(),
    ]);
    const sends = sendsSnap.docs
      .map((d) => serializeAdminDoc(d.id, d.data()))
      .sort((a, b) => String(b.createdAt || b.sentAt || "").localeCompare(String(a.createdAt || a.sentAt || "")));
    const events = eventsSnap.docs
      .map((d) => serializeAdminDoc(d.id, d.data()))
      .sort((a, b) => String(b.at || "").localeCompare(String(a.at || "")));
    return NextResponse.json({
      contact: serializeAdminDoc(snap.id, snap.data() || {}),
      sends,
      events,
      activities: activitiesSnap.docs.map((d) => serializeAdminDoc(d.id, d.data())),
    });
  } catch (e) {
    console.error("GET marketing contact", e);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ contactId: string }> },
) {
  const denied = assertAdminSession(request);
  if (denied) return denied;
  const { contactId } = await params;
  try {
    const parsed = patchSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const db = getAdminDb();
    const ref = db.collection(MARKETING_CONTACTS).doc(contactId);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    const workspaceId = getMarketingWorkspaceId();
    if (String(snap.data()?.workspaceId || workspaceId) !== workspaceId) {
      return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    }
    const updates: Record<string, unknown> = {
      workspaceId,
      updatedAt: FieldValue.serverTimestamp(),
    };
    const d = parsed.data;
    if (d.name !== undefined) updates.name = d.name.trim();
    if (d.company !== undefined) updates.company = d.company.trim();
    if (d.companyId !== undefined) updates.companyId = d.companyId ?? null;
    if (d.title !== undefined) updates.title = d.title.trim();
    if (d.notes !== undefined) updates.notes = d.notes.trim();
    if (d.tags) updates.tags = d.tags;
    if (d.linkedinUrl !== undefined) {
      if (d.linkedinUrl === null) {
        updates.linkedinUrl = null;
      } else {
        const normalized = normalizeLinkedInUrl(d.linkedinUrl);
        if (!normalized) return NextResponse.json({ error: "URL de LinkedIn inválida" }, { status: 400 });
        const duplicate = await db.collection(MARKETING_CONTACTS)
          .where("workspaceId", "==", workspaceId)
          .where("linkedinUrl", "==", normalized)
          .limit(1)
          .get();
        if (duplicate.docs.some((doc) => doc.id !== contactId)) {
          return NextResponse.json({ error: "La URL de LinkedIn ya pertenece a otro contacto" }, { status: 409 });
        }
        updates.linkedinUrl = normalized;
      }
    }
    if (d.linkedinStatus !== undefined) updates.linkedinStatus = d.linkedinStatus;
    if (d.linkedinLastContactAt !== undefined) updates.linkedinLastContactAt = d.linkedinLastContactAt;
    if (d.linkedinNextActionAt !== undefined) updates.linkedinNextActionAt = d.linkedinNextActionAt;
    if (d.linkedinNotes !== undefined) updates.linkedinNotes = d.linkedinNotes.trim();
    if (d.prospectingSource !== undefined) updates.prospectingSource = d.prospectingSource;
    if (d.country) {
      const code = d.country.toUpperCase();
      if (!isMarketingCountryCode(code)) return NextResponse.json({ error: "País no soportado" }, { status: 400 });
      updates.country = code;
    }
    if (d.stage) {
      if (!isMarketingStage(d.stage)) return NextResponse.json({ error: "Etapa inválida" }, { status: 400 });
      updates.stage = d.stage;
      updates.stageManual = d.stage === "not_interested" || d.stage === "unsubscribed";
    }
    await ref.update(updates);
    const next = await ref.get();
    return NextResponse.json({ contact: serializeAdminDoc(next.id, next.data() || {}) });
  } catch (e) {
    console.error("PATCH marketing contact", e);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
