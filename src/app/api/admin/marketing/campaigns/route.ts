import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { assertAdminSession } from "@/lib/assert-admin-session";
import { getAdminDb } from "@/lib/firebase-admin";
import { resolveListLabel } from "@/lib/marketing/audience";
import { materializeCrmCampaignList } from "@/lib/marketing/campaign-segment";
import { campaignMatchesAdminFilters, parseAdminFilterValue } from "@/lib/marketing/admin-filters";
import { MARKETING_CAMPAIGNS, MARKETING_LISTS } from "@/lib/marketing/collections";
import { MarketingError } from "@/lib/marketing/errors";
import { serializeAdminDoc } from "@/lib/marketing/events";
import { namedRecipientSource } from "@/lib/marketing/lists";
import { isMarketingStage } from "@/lib/marketing/stages";
import { emptyCampaignStats, marketingFromEmail, marketingFromName } from "@/lib/marketing/types";

const postSchema = z
  .object({
    name: z.string().min(2).max(160),
    source: z.enum(["list", "crm"]).optional().default("list"),
    listId: z.string().max(80).optional(),
    countryCode: z.string().min(2).max(12).optional(),
    industryId: z.string().min(1).max(80).optional(),
    useCaseId: z.string().min(1).max(80).optional(),
    useCaseIds: z.array(z.string().min(1).max(80)).max(20).optional(),
    country: z.string().min(2).max(12).optional(),
    subject: z.string().min(2).max(200),
    htmlBody: z.string().min(8).max(50_000),
    textBody: z.string().max(20_000).optional().default(""),
    includeStages: z.array(z.string()).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.source === "crm") {
      if (!value.countryCode) ctx.addIssue({ code: "custom", message: "Elegí un país", path: ["countryCode"] });
      if (!value.industryId) ctx.addIssue({ code: "custom", message: "Elegí un rubro", path: ["industryId"] });
      if (!(value.useCaseIds?.length || value.useCaseId)) {
        ctx.addIssue({ code: "custom", message: "Elegí al menos un caso de uso", path: ["useCaseIds"] });
      }
      return;
    }
    if (!value.listId) ctx.addIssue({ code: "custom", message: "Cargá o elegí una lista", path: ["listId"] });
  });

export async function GET(request: NextRequest) {
  const denied = assertAdminSession(request);
  if (denied) return denied;
  try {
    const country = parseAdminFilterValue(request.nextUrl.searchParams.get("country"));
    const industryId = parseAdminFilterValue(request.nextUrl.searchParams.get("industryId"));
    const useCaseId = parseAdminFilterValue(
      request.nextUrl.searchParams.get("useCaseIds") || request.nextUrl.searchParams.get("useCaseId"),
    );
    const status = parseAdminFilterValue(request.nextUrl.searchParams.get("status"));
    const outcome = parseAdminFilterValue(request.nextUrl.searchParams.get("outcome"));
    const audienceKind = parseAdminFilterValue(request.nextUrl.searchParams.get("audienceKind"));
    const listId = parseAdminFilterValue(request.nextUrl.searchParams.get("listId"));
    const stage = parseAdminFilterValue(request.nextUrl.searchParams.get("stage"));
    const q = parseAdminFilterValue(request.nextUrl.searchParams.get("q"));
    const archivedRaw = String(request.nextUrl.searchParams.get("archived") || "hide").trim();
    const archived = archivedRaw === "only" || archivedRaw === "all" ? archivedRaw : "hide";
    const db = getAdminDb();
    const [snap, listsSnap] = await Promise.all([
      db.collection(MARKETING_CAMPAIGNS).limit(400).get(),
      db.collection(MARKETING_LISTS).limit(200).get(),
    ]);
    const listTaxonomy = new Map(
      listsSnap.docs.map((d) => {
        const data = d.data() || {};
        return [
          d.id,
          {
            industryId: String(data.industryId || "").trim(),
            useCaseId: String(data.useCaseId || "").trim(),
            useCaseIds: Array.isArray(data.useCaseIds)
              ? data.useCaseIds.map(String).filter(Boolean)
              : String(data.useCaseId || "").trim()
                ? [String(data.useCaseId).trim()]
                : [],
          },
        ];
      }),
    );
    const campaigns = snap.docs
      .map((d): Record<string, unknown> => {
        const camp = serializeAdminDoc(d.id, d.data());
        const fromList = camp.listId ? listTaxonomy.get(String(camp.listId)) : undefined;
        return {
          ...camp,
          industryId: String(camp.industryId || fromList?.industryId || "") || null,
          useCaseId: String(camp.useCaseId || fromList?.useCaseId || "") || null,
          useCaseIds: Array.isArray(camp.useCaseIds) && camp.useCaseIds.length
            ? camp.useCaseIds
            : fromList?.useCaseIds || (camp.useCaseId ? [camp.useCaseId] : []),
        };
      })
      .filter((camp) =>
        campaignMatchesAdminFilters(camp, {
          q,
          country,
          industryId,
          useCaseId,
          status,
          outcome,
          audienceKind,
          listId,
          stage,
          archived,
        }),
      )
      .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
    return NextResponse.json({ campaigns, total: campaigns.length });
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
    const includeStages = (parsed.data.includeStages || ["new"]).filter(isMarketingStage);
    const materialized =
      parsed.data.source === "crm"
        ? await materializeCrmCampaignList({
            segment: {
              countryCode: parsed.data.countryCode || "",
              industryId: parsed.data.industryId || "",
              useCaseId: parsed.data.useCaseId || "",
              useCaseIds: parsed.data.useCaseIds,
            },
            includeStages,
          })
        : null;
    const list = await resolveListLabel(materialized?.listId || parsed.data.listId);
    if (namedRecipientSource({ listId: list.listId }).kind !== "list") {
      return NextResponse.json({ error: "Cargá o elegí una lista de destinatarios (CSV). No se envía a todos los contactos del CRM." }, { status: 400 });
    }
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
      contactCount: materialized?.eligible || 0,
      stats: emptyCampaignStats(),
      audienceKind: parsed.data.source === "crm" ? "crm" : "list",
      industryId:
        parsed.data.source === "crm" ? parsed.data.industryId || null : list.industryId,
      useCaseId:
        parsed.data.source === "crm"
          ? parsed.data.useCaseIds?.[0] || parsed.data.useCaseId || null
          : list.useCaseId,
      useCaseIds:
        parsed.data.source === "crm"
          ? parsed.data.useCaseIds?.length
            ? parsed.data.useCaseIds
            : parsed.data.useCaseId
              ? [parsed.data.useCaseId]
              : []
          : list.useCaseIds,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      startedAt: null,
      completedAt: null,
    });
    const snap = await ref.get();
    return NextResponse.json({ campaign: serializeAdminDoc(snap.id, snap.data() || {}) }, { status: 201 });
  } catch (e) {
    const status =
      e instanceof MarketingError && (e.code === "validation" || e.code === "not_found")
        ? 400
        : typeof (e as { status?: number }).status === "number"
          ? (e as { status: number }).status
          : 500;
    const msg = e instanceof Error ? e.message : "Error interno";
    console.error("POST marketing campaigns", e);
    return NextResponse.json({ error: msg }, { status });
  }
}
