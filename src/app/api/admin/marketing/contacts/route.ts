import { NextRequest, NextResponse } from "next/server";
import { FieldPath, FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { assertAdminSession } from "@/lib/assert-admin-session";
import { getAdminDb } from "@/lib/firebase-admin";
import { bumpListCount } from "@/lib/marketing/audience";
import { contactMatchesOutcome, parseAdminFilterValue } from "@/lib/marketing/admin-filters";
import { listCompaniesMatchingTaxonomy } from "@/lib/marketing/campaign-segment";
import { MARKETING_CONTACTS } from "@/lib/marketing/collections";
import { isMarketingCountryCode } from "@/lib/marketing/countries";
import { contactIdForEmail, isValidEmail, normalizeEmail } from "@/lib/marketing/csv";
import { serializeAdminDoc } from "@/lib/marketing/events";
import { parseRecipientSource } from "@/lib/marketing/lists";
import { isMarketingStage } from "@/lib/marketing/stages";
import { parseCatalogKeyList, storedKeysMatch } from "@/lib/marketing/taxonomy/seed";

const postSchema = z.object({
  email: z.string().email(),
  name: z.string().max(200).optional().default(""),
  company: z.string().max(200).optional().default(""),
  title: z.string().max(200).optional().default(""),
  country: z.string().min(2).max(2),
  notes: z.string().max(4000).optional().default(""),
  tags: z.array(z.string().max(40)).optional(),
  listId: z.string().max(80).optional(),
});

export async function GET(request: NextRequest) {
  const denied = assertAdminSession(request);
  if (denied) return denied;
  const country = parseAdminFilterValue(request.nextUrl.searchParams.get("country"));
  const stage = parseAdminFilterValue(request.nextUrl.searchParams.get("stage"));
  const listId = parseAdminFilterValue(request.nextUrl.searchParams.get("listId"));
  const industryId = parseAdminFilterValue(request.nextUrl.searchParams.get("industryId"));
  const useCaseId = parseAdminFilterValue(
    request.nextUrl.searchParams.get("useCaseIds") || request.nextUrl.searchParams.get("useCaseId"),
  );
  const outcome = parseAdminFilterValue(request.nextUrl.searchParams.get("outcome"));
  const companyId = parseAdminFilterValue(request.nextUrl.searchParams.get("companyId"));
  const idsParam = (request.nextUrl.searchParams.get("ids") || "").trim();
  const q = (request.nextUrl.searchParams.get("q") || "").trim().toLowerCase();
  const limit = Math.min(500, Math.max(1, Number(request.nextUrl.searchParams.get("limit") || 200) || 200));
  const offset = Math.max(0, Number(request.nextUrl.searchParams.get("offset") || 0) || 0);

  try {
    const db = getAdminDb();

    // fast path: fetch specific contact IDs (e.g. from opportunity contactIds)
    if (idsParam) {
      const ids = idsParam.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 10);
      if (ids.length === 0) return NextResponse.json({ contacts: [] });
      const snap = await db.collection(MARKETING_CONTACTS).where(FieldPath.documentId(), "in", ids).get();
      const contacts = snap.docs.map((d) => serializeAdminDoc(d.id, d.data()));
      return NextResponse.json({ contacts, total: contacts.length });
    }

    let query: FirebaseFirestore.Query = db.collection(MARKETING_CONTACTS);
    if (companyId) {
      query = query.where("companyId", "==", companyId);
    } else if (country && isMarketingCountryCode(country)) {
      query = query.where("country", "==", country);
    }
    const snap = await query.limit(2000).get();
    let contacts = snap.docs.map((d) => serializeAdminDoc(d.id, d.data()));
    if (stage && isMarketingStage(stage)) {
      contacts = contacts.filter((c) => c.stage === stage);
    }
    const listSource = parseRecipientSource(listId);
    if (listSource.kind === "list") {
      contacts = contacts.filter((c) => Array.isArray(c.listIds) && c.listIds.map(String).includes(listSource.listId));
    } else if (listSource.kind === "country" && listSource.country !== "all") {
      contacts = contacts.filter((c) => String(c.country || "").toUpperCase() === listSource.country);
    }
    if (industryId || useCaseId) {
      const useCaseIds = parseCatalogKeyList(useCaseId);
      const companies = await listCompaniesMatchingTaxonomy({
        countryCode: country || undefined,
        industryId: industryId || undefined,
        useCaseIds,
      });
      const ids = new Set(companies.map((row) => row.id));
      const names = new Set(companies.map((row) => row.name.trim().toLowerCase()).filter(Boolean));
      contacts = contacts.filter((c) => {
        if (c.companyId && ids.has(String(c.companyId))) return true;
        if (names.has(String(c.company || "").trim().toLowerCase())) return true;
        if (useCaseIds.some((key) => storedKeysMatch(Array.isArray(c.useCaseIds) ? c.useCaseIds.map(String) : [], key, "useCase"))) {
          return true;
        }
        return false;
      });
    }
    if (outcome) {
      contacts = contacts.filter((c) => contactMatchesOutcome(c, outcome));
    }
    if (q) {
      contacts = contacts.filter((c) => {
        const blob = `${c.email || ""} ${c.name || ""} ${c.company || ""} ${c.title || ""}`.toLowerCase();
        return blob.includes(q);
      });
    }
    contacts.sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
    return NextResponse.json({ contacts: contacts.slice(offset, offset + limit), total: contacts.length, hasMore: contacts.length > offset + limit });
  } catch (e) {
    console.error("GET /api/admin/marketing/contacts", e);
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
    if (!isMarketingCountryCode(parsed.data.country.toUpperCase())) {
      return NextResponse.json({ error: "País no soportado" }, { status: 400 });
    }
    const namedListId = (() => {
      const source = parseRecipientSource(parsed.data.listId);
      return source.kind === "list" ? source.listId : "";
    })();
    const email = normalizeEmail(parsed.data.email);
    if (!isValidEmail(email)) {
      return NextResponse.json({ error: "Email inválido" }, { status: 400 });
    }
    const id = contactIdForEmail(email);
    const db = getAdminDb();
    const ref = db.collection(MARKETING_CONTACTS).doc(id);
    const existing = await ref.get();
    const alreadyInList =
      Boolean(namedListId) &&
      existing.exists &&
      Array.isArray(existing.data()?.listIds) &&
      existing.data()!.listIds.map(String).includes(namedListId);
    const payload: Record<string, unknown> = {
      email,
      emailKey: email,
      name: parsed.data.name.trim(),
      company: parsed.data.company.trim(),
      title: parsed.data.title.trim(),
      country: parsed.data.country.toUpperCase(),
      notes: parsed.data.notes.trim(),
      tags: parsed.data.tags || [],
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (namedListId) payload.listIds = FieldValue.arrayUnion(namedListId);
    if (existing.exists) {
      await ref.update(payload);
    } else {
      await ref.set({
        ...payload,
        listIds: namedListId ? [namedListId] : [],
        stage: "new",
        stageManual: false,
        source: "manual",
        lastCampaignId: null,
        lastSendId: null,
        lastSentAt: null,
        lastOpenedAt: null,
        lastClickedAt: null,
        lastRepliedAt: null,
        createdAt: FieldValue.serverTimestamp(),
      });
    }
    if (namedListId && !alreadyInList) await bumpListCount(namedListId, 1);
    const snap = await ref.get();
    return NextResponse.json({ contact: serializeAdminDoc(snap.id, snap.data() || {}) }, { status: existing.exists ? 200 : 201 });
  } catch (e) {
    console.error("POST /api/admin/marketing/contacts", e);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
