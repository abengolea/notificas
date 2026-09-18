import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { assertAdminSession, getAdminSessionEmail } from "@/lib/assert-admin-session";
import { loadCampaignCatalog } from "@/lib/marketing/campaign-segment";
import { marketingContext } from "@/lib/marketing/context";
import { MarketingError } from "@/lib/marketing/errors";
import { createFirestoreMarketingRepositories } from "@/lib/marketing/repositories/firestore";
import { createMarketingServices } from "@/lib/marketing/services";
import { upsertCatalogFromNames } from "@/lib/marketing/taxonomy/catalog-write";
import { getMarketingWorkspaceId } from "@/lib/marketing/workspace";

export const dynamic = "force-dynamic";

const postSchema = z.object({
  industryName: z.string().min(2).max(120),
  useCaseNames: z.union([z.string().max(4000), z.array(z.string().max(160)).max(40)]),
});

export async function GET(request: NextRequest) {
  const denied = assertAdminSession(request);
  if (denied) return denied;
  try {
    const catalog = await loadCampaignCatalog();
    return NextResponse.json(catalog);
  } catch (e) {
    const status = e instanceof MarketingError && e.code === "validation" ? 400 : 500;
    const msg = e instanceof Error ? e.message : "Error interno";
    console.error("GET marketing catalog", e);
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function POST(request: NextRequest) {
  const denied = assertAdminSession(request);
  if (denied) return denied;
  try {
    const parsed = postSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: "Nombre de rubro y casos de uso inválidos" }, { status: 400 });
    }
    const actorId = getAdminSessionEmail(request) || "catalog-ui";
    const result = await upsertCatalogFromNames(
      { industryName: parsed.data.industryName, useCaseNames: parsed.data.useCaseNames },
      {
        services: createMarketingServices(createFirestoreMarketingRepositories()),
        ctx: marketingContext(getMarketingWorkspaceId(), { actorType: "user", actorId }),
      },
    );
    const catalog = await loadCampaignCatalog();
    return NextResponse.json({ ...result, catalog });
  } catch (e) {
    const status = e instanceof MarketingError && e.code === "validation" ? 400 : 500;
    const msg = e instanceof Error ? e.message : "Error interno";
    console.error("POST marketing catalog", e);
    return NextResponse.json({ error: msg }, { status });
  }
}
