import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { assertAdminSession } from "@/lib/assert-admin-session";
import { getAdminDb } from "@/lib/firebase-admin";
import { parseAdminFilterValue } from "@/lib/marketing/admin-filters";
import { MARKETING_COMPANIES } from "@/lib/marketing/collections";
import { isMarketingCountryCode } from "@/lib/marketing/countries";
import { serializeAdminDoc } from "@/lib/marketing/events";
import { isMarketingCommercialStageId } from "@/lib/marketing/domain/commercial-stages";

const postSchema = z.object({
  name: z.string().min(1).max(200),
  website: z.string().max(200).optional().default(""),
  countryCode: z.string().min(2).max(2),
  industryIds: z.array(z.string().max(80)).optional().default([]),
  useCaseIds: z.array(z.string().max(80)).optional().default([]),
  size: z.enum(["micro", "small", "medium", "large", "enterprise"]).optional(),
  commercialStageId: z.string().max(80).optional().default("nuevo"),
  notes: z.string().max(4000).optional().default(""),
  generalEmail: z.string().email().optional().or(z.literal("")),
  linkedin: z.string().max(300).optional().default(""),
  ownerId: z.string().max(80).optional().default(""),
});

export async function GET(request: NextRequest) {
  const denied = assertAdminSession(request);
  if (denied) return denied;

  const country = parseAdminFilterValue(request.nextUrl.searchParams.get("country"));
  const commercialStageId = parseAdminFilterValue(request.nextUrl.searchParams.get("commercialStageId"));
  const q = (request.nextUrl.searchParams.get("q") || "").trim().toLowerCase();
  const limit = Math.min(500, Math.max(1, Number(request.nextUrl.searchParams.get("limit") || 200) || 200));

  try {
    const db = getAdminDb();
    let query: FirebaseFirestore.Query = db.collection(MARKETING_COMPANIES);

    if (country && isMarketingCountryCode(country)) {
      query = query.where("countryCode", "==", country);
    }
    if (commercialStageId && isMarketingCommercialStageId(commercialStageId)) {
      query = query.where("commercialStageId", "==", commercialStageId);
    }

    const snap = await query.where("deletedAt", "==", null).limit(2000).get();
    let companies = snap.docs.map((d) => serializeAdminDoc(d.id, d.data()));

    if (q) {
      companies = companies.filter((c) => {
        const blob = `${c.name || ""} ${c.website || ""} ${c.generalEmail || ""}`.toLowerCase();
        return blob.includes(q);
      });
    }

    companies.sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
    return NextResponse.json({ companies: companies.slice(0, limit), total: companies.length });
  } catch (e) {
    console.error("GET /api/admin/marketing/companies", e);
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
    if (!isMarketingCountryCode(parsed.data.countryCode.toUpperCase())) {
      return NextResponse.json({ error: "País no soportado" }, { status: 400 });
    }

    const db = getAdminDb();
    const ref = db.collection(MARKETING_COMPANIES).doc();
    const now = FieldValue.serverTimestamp();
    await ref.set({
      name: parsed.data.name.trim(),
      normalizedName: parsed.data.name.trim().toLowerCase(),
      website: parsed.data.website.trim(),
      countryCode: parsed.data.countryCode.toUpperCase(),
      industryIds: parsed.data.industryIds,
      useCaseIds: parsed.data.useCaseIds,
      size: parsed.data.size || null,
      commercialStageId: parsed.data.commercialStageId || "nuevo",
      notes: parsed.data.notes.trim(),
      generalEmail: parsed.data.generalEmail || null,
      linkedin: parsed.data.linkedin.trim(),
      ownerId: parsed.data.ownerId.trim() || null,
      status: "active",
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
    });

    const snap = await ref.get();
    return NextResponse.json({ company: serializeAdminDoc(snap.id, snap.data() || {}) }, { status: 201 });
  } catch (e) {
    console.error("POST /api/admin/marketing/companies", e);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
