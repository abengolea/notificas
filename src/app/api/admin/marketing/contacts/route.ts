import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { assertAdminSession } from "@/lib/assert-admin-session";
import { getAdminDb } from "@/lib/firebase-admin";
import { MARKETING_CONTACTS } from "@/lib/marketing/collections";
import { isMarketingCountryCode } from "@/lib/marketing/countries";
import { contactIdForEmail, isValidEmail, normalizeEmail } from "@/lib/marketing/csv";
import { serializeAdminDoc } from "@/lib/marketing/events";
import { isMarketingStage } from "@/lib/marketing/stages";

const postSchema = z.object({
  email: z.string().email(),
  name: z.string().max(200).optional().default(""),
  company: z.string().max(200).optional().default(""),
  title: z.string().max(200).optional().default(""),
  country: z.string().min(2).max(2),
  notes: z.string().max(4000).optional().default(""),
  tags: z.array(z.string().max(40)).optional(),
});

export async function GET(request: NextRequest) {
  const denied = assertAdminSession(request);
  if (denied) return denied;
  const country = request.nextUrl.searchParams.get("country") || "";
  const stage = request.nextUrl.searchParams.get("stage") || "";
  const q = (request.nextUrl.searchParams.get("q") || "").trim().toLowerCase();
  const limit = Math.min(500, Math.max(1, Number(request.nextUrl.searchParams.get("limit") || 200) || 200));

  try {
    const db = getAdminDb();
    let query: FirebaseFirestore.Query = db.collection(MARKETING_CONTACTS);
    if (country && isMarketingCountryCode(country)) {
      query = query.where("country", "==", country);
    }
    const snap = await query.limit(2000).get();
    let contacts = snap.docs.map((d) => serializeAdminDoc(d.id, d.data()));
    if (stage && isMarketingStage(stage)) {
      contacts = contacts.filter((c) => c.stage === stage);
    }
    if (q) {
      contacts = contacts.filter((c) => {
        const blob = `${c.email || ""} ${c.name || ""} ${c.company || ""} ${c.title || ""}`.toLowerCase();
        return blob.includes(q);
      });
    }
    contacts.sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
    return NextResponse.json({ contacts: contacts.slice(0, limit), total: contacts.length });
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
    const email = normalizeEmail(parsed.data.email);
    if (!isValidEmail(email)) {
      return NextResponse.json({ error: "Email inválido" }, { status: 400 });
    }
    const id = contactIdForEmail(email);
    const db = getAdminDb();
    const ref = db.collection(MARKETING_CONTACTS).doc(id);
    const existing = await ref.get();
    const payload = {
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
    if (existing.exists) {
      await ref.update(payload);
    } else {
      await ref.set({
        ...payload,
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
    const snap = await ref.get();
    return NextResponse.json({ contact: serializeAdminDoc(snap.id, snap.data() || {}) }, { status: existing.exists ? 200 : 201 });
  } catch (e) {
    console.error("POST /api/admin/marketing/contacts", e);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
