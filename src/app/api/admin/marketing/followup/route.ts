import { NextRequest, NextResponse } from "next/server";
import { assertAdminSession } from "@/lib/assert-admin-session";
import { getAdminDb } from "@/lib/firebase-admin";
import { MARKETING_COMPANIES, MARKETING_TASKS } from "@/lib/marketing/collections";
import { serializeAdminDoc } from "@/lib/marketing/events";

export async function GET(request: NextRequest) {
  const denied = assertAdminSession(request);
  if (denied) return denied;

  try {
    const db = getAdminDb();
    const now = new Date().toISOString();
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    const todayEndStr = todayEnd.toISOString();

    const [tasksSnap, companiesSnap] = await Promise.all([
      db.collection(MARKETING_TASKS).where("status", "==", "open").limit(500).get(),
      db.collection(MARKETING_COMPANIES).where("deletedAt", "==", null).limit(2000).get(),
    ]);

    // tasks due today or already overdue
    const tasks = tasksSnap.docs
      .map((d) => serializeAdminDoc(d.id, d.data()))
      .filter((t) => {
        const due = String(t.dueAt || "");
        return due && due <= todayEndStr;
      })
      .sort((a, b) => String(a.dueAt || "").localeCompare(String(b.dueAt || "")));

    // companies with overdue follow-up
    const companies = companiesSnap.docs
      .map((d) => serializeAdminDoc(d.id, d.data()))
      .filter((c) => {
        const fu = String(c.nextFollowUpAt || "");
        return fu && fu <= now;
      })
      .sort((a, b) => String(a.nextFollowUpAt || "").localeCompare(String(b.nextFollowUpAt || "")));

    return NextResponse.json({
      tasks: tasks.slice(0, 100),
      companies: companies.slice(0, 50),
      asOf: now,
    });
  } catch (e) {
    console.error("GET /api/admin/marketing/followup", e);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
