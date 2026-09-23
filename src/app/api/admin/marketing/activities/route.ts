import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { assertAdminSession } from "@/lib/assert-admin-session";
import { getAdminDb } from "@/lib/firebase-admin";
import { parseAdminFilterValue } from "@/lib/marketing/admin-filters";
import { MARKETING_ACTIVITIES } from "@/lib/marketing/collections";
import { serializeAdminDoc } from "@/lib/marketing/events";
import { getMarketingWorkspaceId } from "@/lib/marketing/workspace";

const postSchema = z.object({
  type: z.enum(["note_added", "call", "meeting", "demo", "follow_up_created"]).default("note_added"),
  title: z.string().min(1).max(500),
  description: z.string().max(4000).optional().default(""),
  companyId: z.string().max(80).optional(),
  contactId: z.string().max(80).optional(),
  opportunityId: z.string().max(80).optional(),
});

export async function GET(request: NextRequest) {
  const denied = assertAdminSession(request);
  if (denied) return denied;

  const companyId = parseAdminFilterValue(request.nextUrl.searchParams.get("companyId"));
  const contactId = parseAdminFilterValue(request.nextUrl.searchParams.get("contactId"));
  const opportunityId = parseAdminFilterValue(request.nextUrl.searchParams.get("opportunityId"));
  const limit = Math.min(200, Math.max(1, Number(request.nextUrl.searchParams.get("limit") || 50) || 50));

  try {
    const db = getAdminDb();
    const workspaceId = getMarketingWorkspaceId();
    let query: FirebaseFirestore.Query = db
      .collection(MARKETING_ACTIVITIES)
      .where("workspaceId", "==", workspaceId);

    if (companyId) {
      query = query.where("companyId", "==", companyId);
    } else if (contactId) {
      query = query.where("contactId", "==", contactId);
    } else if (opportunityId) {
      query = query.where("opportunityId", "==", opportunityId);
    } else {
      return NextResponse.json({ error: "Se requiere companyId, contactId u opportunityId" }, { status: 400 });
    }

    const snap = await query.orderBy("createdAt", "desc").limit(limit).get();
    const activities = snap.docs.map((d) => serializeAdminDoc(d.id, d.data()));

    return NextResponse.json({ activities, total: activities.length });
  } catch (e) {
    console.error("GET /api/admin/marketing/activities", e);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const denied = assertAdminSession(request);
  if (denied) return denied;

  try {
    const parsed = postSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const db = getAdminDb();
    const workspaceId = getMarketingWorkspaceId();
    const ref = db.collection(MARKETING_ACTIVITIES).doc();
    await ref.set({
      type: parsed.data.type,
      title: parsed.data.title.trim(),
      description: parsed.data.description.trim() || null,
      companyId: parsed.data.companyId || null,
      contactId: parsed.data.contactId || null,
      opportunityId: parsed.data.opportunityId || null,
      workspaceId,
      actorType: "user",
      createdAt: FieldValue.serverTimestamp(),
    });

    const snap = await ref.get();
    return NextResponse.json({ activity: serializeAdminDoc(snap.id, snap.data() || {}) }, { status: 201 });
  } catch (e) {
    console.error("POST /api/admin/marketing/activities", e);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
