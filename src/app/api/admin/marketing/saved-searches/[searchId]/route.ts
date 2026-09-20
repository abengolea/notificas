import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { assertAdminSession } from "@/lib/assert-admin-session";
import { getAdminDb } from "@/lib/firebase-admin";
import { MARKETING_SAVED_SEARCHES } from "@/lib/marketing/collections";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ searchId: string }> },
) {
  const denied = assertAdminSession(request);
  if (denied) return denied;
  const { searchId } = await params;

  try {
    const db = getAdminDb();
    const ref = db.collection(MARKETING_SAVED_SEARCHES).doc(searchId);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ error: "No encontrada" }, { status: 404 });
    await ref.update({ deletedAt: FieldValue.serverTimestamp() });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("DELETE saved-search", e);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
