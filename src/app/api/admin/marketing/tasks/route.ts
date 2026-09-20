import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { assertAdminSession } from "@/lib/assert-admin-session";
import { getAdminDb } from "@/lib/firebase-admin";
import { parseAdminFilterValue } from "@/lib/marketing/admin-filters";
import { MARKETING_TASKS } from "@/lib/marketing/collections";
import { serializeAdminDoc } from "@/lib/marketing/events";

const TASK_TYPES = ["call", "email", "research", "meeting", "demo", "follow_up", "proposal", "data_completion", "other"] as const;
const TASK_PRIORITIES = ["low", "normal", "high"] as const;

const postSchema = z.object({
  title: z.string().min(1).max(300),
  description: z.string().max(4000).optional().default(""),
  type: z.enum(TASK_TYPES).default("follow_up"),
  priority: z.enum(TASK_PRIORITIES).default("normal"),
  companyId: z.string().max(80).optional(),
  contactId: z.string().max(80).optional(),
  opportunityId: z.string().max(80).optional(),
  assignedTo: z.string().max(80).optional(),
  dueAt: z.string().datetime().nullable().optional(),
});

export async function GET(request: NextRequest) {
  const denied = assertAdminSession(request);
  if (denied) return denied;

  const status = parseAdminFilterValue(request.nextUrl.searchParams.get("status"));
  const companyId = parseAdminFilterValue(request.nextUrl.searchParams.get("companyId"));
  const assignedTo = parseAdminFilterValue(request.nextUrl.searchParams.get("assignedTo"));
  const dueBefore = parseAdminFilterValue(request.nextUrl.searchParams.get("dueBefore"));
  const dueAfter = parseAdminFilterValue(request.nextUrl.searchParams.get("dueAfter"));
  const limit = Math.min(500, Math.max(1, Number(request.nextUrl.searchParams.get("limit") || 200) || 200));

  try {
    const db = getAdminDb();
    let query: FirebaseFirestore.Query = db.collection(MARKETING_TASKS);

    if (status && ["open", "completed", "cancelled"].includes(status)) {
      query = query.where("status", "==", status);
    } else {
      query = query.where("status", "==", "open");
    }
    if (companyId) {
      query = query.where("companyId", "==", companyId);
    }
    if (assignedTo) {
      query = query.where("assignedTo", "==", assignedTo);
    }

    const snap = await query.limit(500).get();
    let tasks = snap.docs.map((d) => serializeAdminDoc(d.id, d.data()));

    if (dueBefore) {
      tasks = tasks.filter((t) => t.dueAt && String(t.dueAt) <= dueBefore);
    }
    if (dueAfter) {
      tasks = tasks.filter((t) => t.dueAt && String(t.dueAt) >= dueAfter);
    }

    tasks.sort((a, b) => {
      if (a.dueAt && b.dueAt) return String(a.dueAt).localeCompare(String(b.dueAt));
      if (a.dueAt) return -1;
      if (b.dueAt) return 1;
      return String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
    });

    return NextResponse.json({ tasks: tasks.slice(0, limit), total: tasks.length });
  } catch (e) {
    console.error("GET /api/admin/marketing/tasks", e);
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
    const ref = db.collection(MARKETING_TASKS).doc();
    const now = FieldValue.serverTimestamp();
    await ref.set({
      title: parsed.data.title.trim(),
      description: parsed.data.description.trim(),
      type: parsed.data.type,
      priority: parsed.data.priority,
      status: "open",
      source: "manual",
      companyId: parsed.data.companyId || null,
      contactId: parsed.data.contactId || null,
      opportunityId: parsed.data.opportunityId || null,
      assignedTo: parsed.data.assignedTo || null,
      dueAt: parsed.data.dueAt || null,
      createdAt: now,
      updatedAt: now,
    });

    const snap = await ref.get();
    return NextResponse.json({ task: serializeAdminDoc(snap.id, snap.data() || {}) }, { status: 201 });
  } catch (e) {
    console.error("POST /api/admin/marketing/tasks", e);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
