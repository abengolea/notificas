import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { assertAdminSession } from "@/lib/assert-admin-session";
import { getAdminDb } from "@/lib/firebase-admin";
import { MARKETING_SAVED_SEARCHES } from "@/lib/marketing/collections";
import { serializeAdminDoc } from "@/lib/marketing/events";

const postSchema = z.object({
  name: z.string().min(1).max(100),
  entityType: z.enum(["company", "contact", "opportunity", "campaign"]),
  filters: z.record(z.unknown()),
});

export async function GET(request: NextRequest) {
  const denied = assertAdminSession(request);
  if (denied) return denied;

  const entityType = request.nextUrl.searchParams.get("entityType") || "";

  try {
    const db = getAdminDb();
    let query: FirebaseFirestore.Query = db.collection(MARKETING_SAVED_SEARCHES).where("deletedAt", "==", null);
    if (entityType) query = query.where("entityType", "==", entityType);
    const snap = await query.orderBy("createdAt", "desc").limit(50).get();
    const searches = snap.docs.map((d) => serializeAdminDoc(d.id, d.data()));
    return NextResponse.json({ searches });
  } catch (e) {
    console.error("GET saved-searches", e);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const denied = assertAdminSession(request);
  if (denied) return denied;

  try {
    const parsed = postSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

    const db = getAdminDb();
    const now = FieldValue.serverTimestamp();
    const ref = db.collection(MARKETING_SAVED_SEARCHES).doc();
    await ref.set({
      name: parsed.data.name.trim(),
      entityType: parsed.data.entityType,
      filters: parsed.data.filters,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
    });
    const snap = await ref.get();
    return NextResponse.json({ search: serializeAdminDoc(snap.id, snap.data() || {}) }, { status: 201 });
  } catch (e) {
    console.error("POST saved-searches", e);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
