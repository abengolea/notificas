import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { assertAdminSession } from "@/lib/assert-admin-session";
import { getAdminDb } from "@/lib/firebase-admin";
import { parseAdminFilterValue } from "@/lib/marketing/admin-filters";
import { MARKETING_ACTIVITIES, MARKETING_COMPANIES, MARKETING_OPPORTUNITIES } from "@/lib/marketing/collections";
import { serializeAdminDoc } from "@/lib/marketing/events";
import { isMarketingCommercialStageId } from "@/lib/marketing/domain/commercial-stages";
import { isMarketingCountryCode } from "@/lib/marketing/countries";

const postSchema = z.object({
  name: z.string().min(1).max(300),
  companyId: z.string().max(80).optional(),
  contactIds: z.array(z.string().max(80)).optional().default([]),
  commercialStageId: z.string().max(80).default("interesado"),
  estimatedValue: z.number().positive().optional(),
  currency: z.string().max(10).optional().default("USD"),
  nextStep: z.string().max(1000).optional().default(""),
  nextActionAt: z.string().datetime().nullable().optional(),
  notes: z.string().max(4000).optional().default(""),
  countryCode: z.string().min(2).max(2).optional(),
});

export async function GET(request: NextRequest) {
  const denied = assertAdminSession(request);
  if (denied) return denied;

  const commercialStageId = parseAdminFilterValue(request.nextUrl.searchParams.get("commercialStageId"));
  const companyId = parseAdminFilterValue(request.nextUrl.searchParams.get("companyId"));
  const contactId = parseAdminFilterValue(request.nextUrl.searchParams.get("contactId"));
  const statusFilter = parseAdminFilterValue(request.nextUrl.searchParams.get("status"));
  const country = parseAdminFilterValue(request.nextUrl.searchParams.get("country"));
  const q = (request.nextUrl.searchParams.get("q") || "").trim().toLowerCase();
  const limit = Math.min(500, Math.max(1, Number(request.nextUrl.searchParams.get("limit") || 300) || 300));

  try {
    const db = getAdminDb();
    let query: FirebaseFirestore.Query = db.collection(MARKETING_OPPORTUNITIES);

    if (statusFilter === "all") {
      // no status filter — return all statuses (used by admin view)
    } else if (statusFilter && ["open", "won", "lost", "paused"].includes(statusFilter)) {
      query = query.where("status", "==", statusFilter);
    } else {
      query = query.where("status", "==", "open");
    }
    if (companyId) {
      query = query.where("companyId", "==", companyId);
    }
    if (commercialStageId && isMarketingCommercialStageId(commercialStageId)) {
      query = query.where("commercialStageId", "==", commercialStageId);
    }

    const snap = await query.where("deletedAt", "==", null).limit(limit).get();
    let opps = snap.docs.map((d) => serializeAdminDoc(d.id, d.data()));

    if (q) {
      opps = opps.filter((o) => String(o.name || "").toLowerCase().includes(q));
    }
    if (contactId) {
      opps = opps.filter((o) => Array.isArray(o.contactIds) && (o.contactIds as string[]).includes(contactId));
    }

    // enrich with company names (batch fetch unique companyIds)
    const companyIds = [...new Set(opps.map((o) => o.companyId).filter(Boolean) as string[])];
    if (companyIds.length > 0) {
      const companySnaps = await Promise.all(
        companyIds.map((id) => db.collection(MARKETING_COMPANIES).doc(id).get())
      );
      const companyNames = new Map(companySnaps.map((s) => [s.id, s.data()?.name as string | undefined]));
      opps = opps.map((o) => ({
        ...o,
        companyName: o.companyId ? (companyNames.get(o.companyId as string) ?? null) : null,
      }));
    }

    return NextResponse.json({ opportunities: opps, total: opps.length });
  } catch (e) {
    console.error("GET /api/admin/marketing/opportunities", e);
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
    const ref = db.collection(MARKETING_OPPORTUNITIES).doc();
    const now = FieldValue.serverTimestamp();
    await ref.set({
      name: parsed.data.name.trim(),
      companyId: parsed.data.companyId || null,
      contactIds: parsed.data.contactIds,
      commercialStageId: parsed.data.commercialStageId,
      estimatedValue: parsed.data.estimatedValue || null,
      currency: parsed.data.currency,
      nextStep: parsed.data.nextStep.trim(),
      nextActionAt: parsed.data.nextActionAt || null,
      notes: parsed.data.notes.trim(),
      countryCode: parsed.data.countryCode || null,
      status: "open",
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
    });

    const snap = await ref.get();
    return NextResponse.json({ opportunity: serializeAdminDoc(snap.id, snap.data() || {}) }, { status: 201 });
  } catch (e) {
    console.error("POST /api/admin/marketing/opportunities", e);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
