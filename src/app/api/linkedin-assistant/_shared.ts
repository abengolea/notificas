import { NextRequest, NextResponse } from "next/server";
import { MarketingError } from "@/lib/marketing/errors";
import { marketingContext } from "@/lib/marketing/context";
import {
  assertLinkedInAssistantAuth,
  linkedInAssistantActorId,
  linkedInAssistantCorsHeaders,
} from "@/lib/marketing/linkedin-assistant-auth";
import { createLinkedInAssistantService } from "@/lib/marketing/linkedin-assistant";
import { createFirestoreMarketingRepositories } from "@/lib/marketing/repositories/firestore";
import { createMarketingServices } from "@/lib/marketing/services";
import { getMarketingWorkspaceId } from "@/lib/marketing/workspace";

export function linkedInAssistantRuntime(request: NextRequest) {
  const repos = createFirestoreMarketingRepositories();
  const services = createMarketingServices(repos);
  const assistant = createLinkedInAssistantService({
    linkedIn: services.linkedInCampaigns,
    campaigns: repos.linkedInCampaigns,
    members: repos.linkedInCampaignMembers,
    contacts: repos.contacts,
    activities: repos.activities,
  });
  const context = marketingContext(getMarketingWorkspaceId(), {
    actorType: "user",
    actorId: linkedInAssistantActorId(request),
  });
  return { assistant, context };
}

export function linkedInAssistantApiError(error: unknown) {
  if (error instanceof MarketingError) {
    const status =
      error.code === "not_found" ? 404 :
      error.code === "conflict" ? 409 :
      error.code === "workspace" ? 403 : 400;
    return NextResponse.json({ error: error.message, details: error.details }, { status });
  }
  console.error("LinkedIn Assistant API", error);
  return NextResponse.json({ error: "Error interno" }, { status: 500 });
}

export function withLinkedInAssistantCors(response: NextResponse, request: NextRequest) {
  const headers = linkedInAssistantCorsHeaders(request.headers.get("Origin"));
  for (const [key, value] of Object.entries(headers)) {
    response.headers.set(key, value);
  }
  return response;
}

export function assertLinkedInAssistant(request: NextRequest): NextResponse | null {
  return assertLinkedInAssistantAuth(request);
}
