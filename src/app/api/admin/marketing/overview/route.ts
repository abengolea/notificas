import { NextRequest, NextResponse } from "next/server";
import { assertAdminSession } from "@/lib/assert-admin-session";
import { getAdminDb } from "@/lib/firebase-admin";
import { MARKETING_ACTIVITIES, MARKETING_CAMPAIGNS, MARKETING_COMPANIES, MARKETING_CONTACTS, MARKETING_OPPORTUNITIES, MARKETING_TASKS } from "@/lib/marketing/collections";
import { MARKETING_COUNTRIES, countryName, type MarketingCountryCode } from "@/lib/marketing/countries";
import { serializeAdminDoc } from "@/lib/marketing/events";
import { gmailStatus } from "@/lib/marketing/gmail";
import { MARKETING_STAGES, type MarketingStage } from "@/lib/marketing/stages";
import { marketingFromEmail, marketingReplyTo } from "@/lib/marketing/types";
import { MARKETING_COMMERCIAL_STAGE_SEED } from "@/lib/marketing/domain/commercial-stages";

function emptyStages(): Record<MarketingStage, number> {
  return Object.fromEntries(MARKETING_STAGES.map((s) => [s, 0])) as Record<MarketingStage, number>;
}

export async function GET(request: NextRequest) {
  const denied = assertAdminSession(request);
  if (denied) return denied;
  try {
    const db = getAdminDb();
    const [contactsSnap, campaignsSnap, companiesSnap, tasksSnap, activitiesSnap, opportunitiesSnap, gmail] = await Promise.all([
      db.collection(MARKETING_CONTACTS).limit(8000).get(),
      db.collection(MARKETING_CAMPAIGNS).limit(40).get(),
      db.collection(MARKETING_COMPANIES).where("deletedAt", "==", null).limit(5000).get(),
      db.collection(MARKETING_TASKS).where("status", "==", "open").limit(500).get(),
      db.collection(MARKETING_ACTIVITIES).orderBy("createdAt", "desc").limit(15).get(),
      db.collection(MARKETING_OPPORTUNITIES).where("status", "==", "open").limit(1000).get(),
      gmailStatus(),
    ]);

    const byCountry = new Map<string, Record<MarketingStage, number>>();
    for (const c of MARKETING_COUNTRIES) byCountry.set(c.code, emptyStages());
    let total = 0;
    const allStages = emptyStages();
    for (const doc of contactsSnap.docs) {
      const data = doc.data();
      const country = String(data.country || "");
      const stage = (MARKETING_STAGES as readonly string[]).includes(String(data.stage))
        ? (data.stage as MarketingStage)
        : "new";
      total += 1;
      allStages[stage] += 1;
      if (!byCountry.has(country)) byCountry.set(country, emptyStages());
      byCountry.get(country)![stage] += 1;
    }

    const countries = [...byCountry.entries()]
      .map(([code, stages]) => {
        const count = MARKETING_STAGES.reduce((n, s) => n + stages[s], 0);
        return {
          code: code as MarketingCountryCode,
          name: countryName(code),
          total: count,
          stages,
        };
      })
      .filter((r) => r.total > 0)
      .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, "es"));

    const campaigns = campaignsSnap.docs
      .map((d) => serializeAdminDoc(d.id, d.data()))
      .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
      .slice(0, 8);

    // commercial pipeline funnel (companies by stage)
    const stageCountMap: Record<string, number> = {};
    for (const doc of companiesSnap.docs) {
      const stageId = String(doc.data().commercialStageId || "nuevo");
      stageCountMap[stageId] = (stageCountMap[stageId] || 0) + 1;
    }
    const pipeline = MARKETING_COMMERCIAL_STAGE_SEED.map((s) => ({
      id: s.id,
      name: s.name,
      count: stageCountMap[s.id] || 0,
      isWon: s.isWon || false,
      isLost: s.isLost || false,
    }));

    // tasks summary
    const now = new Date().toISOString();
    const overdueCount = tasksSnap.docs.filter((d) => {
      const due = String(d.data().dueAt || "");
      return due && due < now;
    }).length;
    const dueTodayCount = tasksSnap.docs.filter((d) => {
      const due = String(d.data().dueAt || "");
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);
      return due && due >= now && due <= todayEnd.toISOString();
    }).length;

    const companyNameMap = new Map(companiesSnap.docs.map((d) => [d.id, d.data().name as string | undefined]));
    const contactNameMap = new Map(contactsSnap.docs.map((d) => [d.id, (d.data().name || d.data().email) as string | undefined]));
    const recentActivities = activitiesSnap.docs.map((d) => {
      const a = serializeAdminDoc(d.id, d.data());
      return {
        ...a,
        companyName: a.companyId ? (companyNameMap.get(a.companyId as string) ?? null) : null,
        contactName: a.contactId ? (contactNameMap.get(a.contactId as string) ?? null) : null,
      };
    });

    const pipelineValue = opportunitiesSnap.docs.reduce((sum, d) => {
      const v = Number(d.data().estimatedValue || 0);
      return sum + (isNaN(v) ? 0 : v);
    }, 0);

    return NextResponse.json({
      fromEmail: marketingFromEmail(),
      replyTo: marketingReplyTo(),
      gmail,
      total,
      stages: allStages,
      countries,
      campaigns,
      pipeline,
      companies: { total: companiesSnap.size },
      tasks: { open: tasksSnap.size, overdue: overdueCount, dueToday: dueTodayCount },
      opportunities: { open: opportunitiesSnap.size, pipelineValue },
      recentActivities,
    });
  } catch (e) {
    console.error("GET marketing overview", e);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
