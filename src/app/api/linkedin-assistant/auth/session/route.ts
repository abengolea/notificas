import { NextRequest, NextResponse } from "next/server";
import {
  assertLinkedInAssistant,
  withLinkedInAssistantCors,
} from "../../_shared";
import { getAdminSessionEmail } from "@/lib/assert-admin-session";
import { linkedInAssistantActorId } from "@/lib/marketing/linkedin-assistant-auth";
import { getMarketingWorkspaceId } from "@/lib/marketing/workspace";

export async function OPTIONS(request: NextRequest) {
  return withLinkedInAssistantCors(new NextResponse(null, { status: 204 }), request);
}

export async function GET(request: NextRequest) {
  const denied = assertLinkedInAssistant(request);
  if (denied) return withLinkedInAssistantCors(denied, request);

  const email = getAdminSessionEmail(request) || linkedInAssistantActorId(request);
  return withLinkedInAssistantCors(
    NextResponse.json({
      ok: true,
      user: { email },
      environment: process.env.NODE_ENV === "production" ? "production" : "development",
      workspaceId: getMarketingWorkspaceId(),
    }),
    request,
  );
}
