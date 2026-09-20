import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { assertAdminSession } from "@/lib/assert-admin-session";
import { getAdminDb } from "@/lib/firebase-admin";
import { MARKETING_ACTIVITIES, MARKETING_COMPANIES, MARKETING_CONTACTS, MARKETING_OPPORTUNITIES } from "@/lib/marketing/collections";
import { serializeAdminDoc } from "@/lib/marketing/events";
import { isMarketingCommercialStageId } from "@/lib/marketing/domain/commercial-stages";

const patchSchema = z.object({
  name: z.string().min(1).max(300).optional(),
  commercialStageId: z.string().max(80).optional(),
  estimatedValue: z.number().positive().nullable().optional(),
  currency: z.string().max(10).optional(),
  nextStep: z.string().max(1000).optional(),
  nextActionAt: z.string().datetime().nullable().optional(),
  notes: z.string().max(4000).optional(),
  status: z.enum(["open", "won", "lost", "paused"]).optional(),
  companyId: z.string().max(80).nullable().optional(),
  contactIds: z.array(z.string().max(80)).optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ opportunityId: string }> },
) {
  const denied = assertAdminSession(request);
  if (denied) return denied;
  const { opportunityId } = await params;

  try {
    const db = getAdminDb();
    const snap = await db.collection(MARKETING_OPPORTUNITIES).doc(opportunityId).get();
    if (!snap.exists || snap.data()?.deletedAt) {
      return NextResponse.json({ error: "No encontrada" }, { status: 404 });
    }
    const opportunity = serializeAdminDoc(snap.id, snap.data() || {});

    // enrich with company name and contact names
    const enrichments: Promise<void>[] = [];
    let companyName: string | null = null;
    const contactNames = new Map<string, string>();
    if (opportunity.companyId) {
      enrichments.push(
        db.collection(MARKETING_COMPANIES).doc(String(opportunity.companyId)).get().then((s) => {
          if (s.exists) companyName = (s.data()?.name as string) || null;
        })
      );
    }
    const contactIds = Array.isArray(opportunity.contactIds) ? (opportunity.contactIds as string[]) : [];
    if (contactIds.length > 0) {
      enrichments.push(
        Promise.all(contactIds.map((id) => db.collection(MARKETING_CONTACTS).doc(id).get())).then((snaps) => {
          snaps.forEach((s) => { if (s.exists) contactNames.set(s.id, (s.data()?.name as string) || s.data()?.email as string || s.id); });
        })
      );
    }
    await Promise.all(enrichments);

    return NextResponse.json({
      opportunity: {
        ...opportunity,
        companyName,
        contactNames: Object.fromEntries(contactNames),
      },
    });
  } catch (e) {
    console.error("GET marketing opportunity", e);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ opportunityId: string }> },
) {
  const denied = assertAdminSession(request);
  if (denied) return denied;
  const { opportunityId } = await params;

  try {
    const parsed = patchSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const db = getAdminDb();
    const ref = db.collection(MARKETING_OPPORTUNITIES).doc(opportunityId);
    const existing = await ref.get();
    if (!existing.exists || existing.data()?.deletedAt) {
      return NextResponse.json({ error: "No encontrada" }, { status: 404 });
    }

    const { commercialStageId, ...rest } = parsed.data;
    const payload: Record<string, unknown> = { ...rest, updatedAt: FieldValue.serverTimestamp() };

    if (commercialStageId) {
      if (!isMarketingCommercialStageId(commercialStageId)) {
        return NextResponse.json({ error: "Etapa inválida" }, { status: 400 });
      }
      payload.commercialStageId = commercialStageId;
      const prevStage = existing.data()?.commercialStageId;
      if (prevStage !== commercialStageId) {
        const actRef = db.collection(MARKETING_ACTIVITIES).doc();
        await actRef.set({
          type: "status_changed",
          opportunityId,
          companyId: existing.data()?.companyId || null,
          actorType: "user",
          title: `Etapa cambiada a "${commercialStageId}"`,
          metadata: { from: prevStage || null, to: commercialStageId },
          createdAt: FieldValue.serverTimestamp(),
        });
      }
    }

    // log status change (won/lost/paused/reopen)
    if (parsed.data.status && parsed.data.status !== existing.data()?.status) {
      const statusLabels: Record<string, string> = { won: "Ganada", lost: "Perdida", paused: "Pausada", open: "Reabierta" };
      const actRef = db.collection(MARKETING_ACTIVITIES).doc();
      await actRef.set({
        type: "opportunity_status_changed",
        opportunityId,
        companyId: existing.data()?.companyId || null,
        actorType: "user",
        title: `Oportunidad ${statusLabels[parsed.data.status] || parsed.data.status}: ${existing.data()?.name || ""}`,
        metadata: { from: existing.data()?.status || null, to: parsed.data.status, oppName: existing.data()?.name || null },
        createdAt: FieldValue.serverTimestamp(),
      });
    }

    Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k]);
    await ref.update(payload);
    const snap = await ref.get();
    return NextResponse.json({ opportunity: serializeAdminDoc(snap.id, snap.data() || {}) });
  } catch (e) {
    console.error("PATCH marketing opportunity", e);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
