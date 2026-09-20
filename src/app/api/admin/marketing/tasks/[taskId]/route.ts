import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { assertAdminSession } from "@/lib/assert-admin-session";
import { getAdminDb } from "@/lib/firebase-admin";
import { MARKETING_TASKS } from "@/lib/marketing/collections";
import { serializeAdminDoc } from "@/lib/marketing/events";

const patchSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  description: z.string().max(4000).optional(),
  priority: z.enum(["low", "normal", "high"]).optional(),
  dueAt: z.string().datetime().nullable().optional(),
  assignedTo: z.string().max(80).nullable().optional(),
  status: z.enum(["open", "completed", "cancelled"]).optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> },
) {
  const denied = assertAdminSession(request);
  if (denied) return denied;
  const { taskId } = await params;

  try {
    const parsed = patchSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const db = getAdminDb();
    const ref = db.collection(MARKETING_TASKS).doc(taskId);
    const existing = await ref.get();
    if (!existing.exists) {
      return NextResponse.json({ error: "No encontrada" }, { status: 404 });
    }

    const payload: Record<string, unknown> = { ...parsed.data, updatedAt: FieldValue.serverTimestamp() };

    if (parsed.data.status === "completed" && existing.data()?.status !== "completed") {
      payload.completedAt = FieldValue.serverTimestamp();
    }

    Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k]);

    await ref.update(payload);
    const snap = await ref.get();
    return NextResponse.json({ task: serializeAdminDoc(snap.id, snap.data() || {}) });
  } catch (e) {
    console.error("PATCH marketing task", e);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
