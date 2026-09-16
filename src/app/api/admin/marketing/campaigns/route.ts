import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { assertAdminSession } from "@/lib/assert-admin-session";
import { getAdminDb } from "@/lib/firebase-admin";
import { resolveListLabel } from "@/lib/marketing/audience";
import { MARKETING_CAMPAIGNS } from "@/lib/marketing/collections";
import { serializeAdminDoc } from "@/lib/marketing/events";
import { namedRecipientSource } from "@/lib/marketing/lists";
import { isMarketingStage } from "@/lib/marketing/stages";
import { emptyCampaignStats, marketingFromEmail, marketingFromName } from "@/lib/marketing/types";

const postSchema = z.object({
  name: z.string().min(2).max(160),
  listId: z.string().min(1).max(80),
  country: z.string().min(2).max(12).optional(),
  subject: z.string().min(2).max(200),
  htmlBody: z.string().min(8).max(50_000),
  textBody: z.string().max(20_000).optional().default(""),
  includeStages: z.array(z.string()).optional(),
});

export async function GET(request: NextRequest) {
  const denied = assertAdminSession(request);
  if (denied) return denied;
  try {
    const db = getAdminDb();
    const snap = await db.collection(MARKETING_CAMPAIGNS).limit(100).get();
    const campaigns = snap.docs
      .map((d) => serializeAdminDoc(d.id, d.data()))
      .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
    return NextResponse.json({ campaigns });
  } catch (e) {
    console.error("GET marketing campaigns", e);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const denied = assertAdminSession(request);
  if (denied) return denied;
  try {
    const parsed = postSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const list = await resolveListLabel(parsed.data.listId);
    if (namedRecipientSource({ listId: list.listId }).kind !== "list") {
      return NextResponse.json({ error: "Cargá o elegí una lista de destinatarios (CSV). No se envía a todos los contactos del CRM." }, { status: 400 });
    }
    const includeStages = (parsed.data.includeStages || ["new"]).filter(isMarketingStage);
    const db = getAdminDb();
    const ref = db.collection(MARKETING_CAMPAIGNS).doc();
    await ref.set({
      name: parsed.data.name.trim(),
      country: list.country,
      listId: list.listId,
      listName: list.listName,
      subject: parsed.data.subject.trim(),
      htmlBody: parsed.data.htmlBody,
      textBody: parsed.data.textBody || "",
      fromEmail: marketingFromEmail(),
      fromName: marketingFromName(),
      status: "draft",
      includeStages: includeStages.length ? includeStages : ["new"],
      contactCount: 0,
      stats: emptyCampaignStats(),
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      startedAt: null,
      completedAt: null,
    });
    const snap = await ref.get();
    return NextResponse.json({ campaign: serializeAdminDoc(snap.id, snap.data() || {}) }, { status: 201 });
  } catch (e) {
    const status = typeof (e as { status?: number }).status === "number" ? (e as { status: number }).status : 500;
    const msg = e instanceof Error ? e.message : "Error interno";
    console.error("POST marketing campaigns", e);
    return NextResponse.json({ error: msg }, { status });
  }
}
