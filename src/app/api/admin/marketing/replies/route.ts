import { NextRequest, NextResponse } from "next/server";
import { assertAdminSession } from "@/lib/assert-admin-session";
import { getAdminDb } from "@/lib/firebase-admin";
import { MARKETING_SENDS } from "@/lib/marketing/collections";
import { serializeAdminDoc } from "@/lib/marketing/events";

export async function GET(request: NextRequest) {
  const denied = assertAdminSession(request);
  if (denied) return denied;

  const limit = Math.min(100, Math.max(1, Number(request.nextUrl.searchParams.get("limit") || 50) || 50));

  try {
    const db = getAdminDb();
    // Sends that have a reply (repliedAt is set), ordered newest first
    const snap = await db
      .collection(MARKETING_SENDS)
      .where("repliedAt", "!=", null)
      .orderBy("repliedAt", "desc")
      .limit(limit)
      .get();

    const replies = snap.docs.map((d) => serializeAdminDoc(d.id, d.data()));
    return NextResponse.json({ replies, total: replies.length });
  } catch (e) {
    console.error("GET /api/admin/marketing/replies", e);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
