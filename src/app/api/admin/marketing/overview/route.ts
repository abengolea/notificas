import { NextRequest, NextResponse } from "next/server";
import { assertAdminSession } from "@/lib/assert-admin-session";
import { getAdminDb } from "@/lib/firebase-admin";
import { MARKETING_CAMPAIGNS, MARKETING_CONTACTS } from "@/lib/marketing/collections";
import { MARKETING_COUNTRIES, countryName, type MarketingCountryCode } from "@/lib/marketing/countries";
import { serializeAdminDoc } from "@/lib/marketing/events";
import { gmailStatus } from "@/lib/marketing/gmail";
import { MARKETING_STAGES, type MarketingStage } from "@/lib/marketing/stages";
import { marketingFromEmail, marketingReplyTo } from "@/lib/marketing/types";

function emptyStages(): Record<MarketingStage, number> {
  return Object.fromEntries(MARKETING_STAGES.map((s) => [s, 0])) as Record<MarketingStage, number>;
}

export async function GET(request: NextRequest) {
  const denied = assertAdminSession(request);
  if (denied) return denied;
  try {
    const db = getAdminDb();
    const [contactsSnap, campaignsSnap, gmail] = await Promise.all([
      db.collection(MARKETING_CONTACTS).limit(8000).get(),
      db.collection(MARKETING_CAMPAIGNS).limit(40).get(),
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

    return NextResponse.json({
      fromEmail: marketingFromEmail(),
      replyTo: marketingReplyTo(),
      gmail,
      total,
      stages: allStages,
      countries,
      campaigns,
    });
  } catch (e) {
    console.error("GET marketing overview", e);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
