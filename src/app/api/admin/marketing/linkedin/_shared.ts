import { NextResponse } from "next/server";
import { MarketingError } from "@/lib/marketing/errors";
import { marketingContext } from "@/lib/marketing/context";
import { createFirestoreMarketingRepositories } from "@/lib/marketing/repositories/firestore";
import { createMarketingServices } from "@/lib/marketing/services";
import { getMarketingWorkspaceId } from "@/lib/marketing/workspace";

export function linkedInAdminRuntime() {
  const services = createMarketingServices(createFirestoreMarketingRepositories());
  const context = marketingContext(getMarketingWorkspaceId(), {
    actorType: "user",
    actorId: "admin",
  });
  return { service: services.linkedInCampaigns, context };
}

export function linkedInApiError(error: unknown) {
  if (error instanceof MarketingError) {
    const status =
      error.code === "not_found" ? 404 :
      error.code === "conflict" ? 409 :
      error.code === "workspace" ? 403 : 400;
    return NextResponse.json({ error: error.message, details: error.details }, { status });
  }
  console.error("LinkedIn campaign API", error);
  return NextResponse.json({ error: "Error interno" }, { status: 500 });
}
