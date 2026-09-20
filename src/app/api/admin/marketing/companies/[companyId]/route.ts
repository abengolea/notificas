import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { assertAdminSession } from "@/lib/assert-admin-session";
import { getAdminDb } from "@/lib/firebase-admin";
import { MARKETING_ACTIVITIES, MARKETING_COMPANIES } from "@/lib/marketing/collections";
import { serializeAdminDoc } from "@/lib/marketing/events";
import { isMarketingCountryCode } from "@/lib/marketing/countries";
import { isMarketingCommercialStageId } from "@/lib/marketing/domain/commercial-stages";

const patchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  website: z.string().max(200).optional(),
  countryCode: z.string().min(2).max(2).optional(),
  industryIds: z.array(z.string().max(80)).optional(),
  useCaseIds: z.array(z.string().max(80)).optional(),
  size: z.enum(["micro", "small", "medium", "large", "enterprise"]).nullable().optional(),
  commercialStageId: z.string().max(80).optional(),
  notes: z.string().max(4000).optional(),
  generalEmail: z.string().email().optional().or(z.literal("")),
  linkedin: z.string().max(300).optional(),
  ownerId: z.string().max(80).optional(),
  nextFollowUpAt: z.string().datetime().nullable().optional(),
  lastContactAt: z.string().datetime().nullable().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> },
) {
  const denied = assertAdminSession(request);
  if (denied) return denied;
  const { companyId } = await params;

  try {
    const db = getAdminDb();
    const snap = await db.collection(MARKETING_COMPANIES).doc(companyId).get();
    if (!snap.exists || snap.data()?.deletedAt) {
      return NextResponse.json({ error: "No encontrada" }, { status: 404 });
    }

    const activitiesSnap = await db
      .collection(MARKETING_ACTIVITIES)
      .where("companyId", "==", companyId)
      .orderBy("createdAt", "desc")
      .limit(50)
      .get();

    const company = serializeAdminDoc(snap.id, snap.data() || {});
    const activities = activitiesSnap.docs.map((d) => serializeAdminDoc(d.id, d.data()));

    return NextResponse.json({ company, activities });
  } catch (e) {
    console.error("GET marketing company", e);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> },
) {
  const denied = assertAdminSession(request);
  if (denied) return denied;
  const { companyId } = await params;

  try {
    const parsed = patchSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const db = getAdminDb();
    const ref = db.collection(MARKETING_COMPANIES).doc(companyId);
    const existing = await ref.get();
    if (!existing.exists || existing.data()?.deletedAt) {
      return NextResponse.json({ error: "No encontrada" }, { status: 404 });
    }

    const { countryCode, commercialStageId, ...rest } = parsed.data;
    const payload: Record<string, unknown> = { ...rest, updatedAt: FieldValue.serverTimestamp() };

    if (countryCode) {
      if (!isMarketingCountryCode(countryCode.toUpperCase())) {
        return NextResponse.json({ error: "País no soportado" }, { status: 400 });
      }
      payload.countryCode = countryCode.toUpperCase();
    }
    if (commercialStageId) {
      if (!isMarketingCommercialStageId(commercialStageId)) {
        return NextResponse.json({ error: "Etapa inválida" }, { status: 400 });
      }
      payload.commercialStageId = commercialStageId;

      // record stage change activity
      const prevStage = existing.data()?.commercialStageId;
      if (prevStage !== commercialStageId) {
        const actRef = db.collection(MARKETING_ACTIVITIES).doc();
        await actRef.set({
          type: "status_changed",
          companyId,
          actorType: "user",
          title: `Etapa cambiada a "${commercialStageId}"`,
          metadata: { from: prevStage || null, to: commercialStageId },
          createdAt: FieldValue.serverTimestamp(),
        });
      }
    }
    if (parsed.data.name) {
      payload.normalizedName = parsed.data.name.trim().toLowerCase();
    }

    // remove undefined keys
    Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k]);

    await ref.update(payload);
    const snap = await ref.get();
    return NextResponse.json({ company: serializeAdminDoc(snap.id, snap.data() || {}) });
  } catch (e) {
    console.error("PATCH marketing company", e);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
