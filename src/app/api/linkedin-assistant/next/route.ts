import { NextRequest, NextResponse } from "next/server";
import { canonicalizeLinkedInMemberStatus } from "@/lib/marketing/linkedin-outreach";
import {
  assertLinkedInAssistant,
  linkedInAssistantApiError,
  linkedInAssistantRuntime,
  withLinkedInAssistantCors,
} from "../_shared";

export async function OPTIONS(request: NextRequest) {
  return withLinkedInAssistantCors(new NextResponse(null, { status: 204 }), request);
}

export async function GET(request: NextRequest) {
  const denied = assertLinkedInAssistant(request);
  if (denied) return withLinkedInAssistantCors(denied, request);
  try {
    const params = request.nextUrl.searchParams;
    const campaignId = params.get("campaignId") || undefined;
    const countryCode = params.get("countryCode") || undefined;
    const statusRaw = params.get("status") || undefined;
    const status = canonicalizeLinkedInMemberStatus(statusRaw);
    const excludeMemberId = params.get("excludeMemberId") || undefined;

    const { assistant, context } = linkedInAssistantRuntime(request);
    const action = await assistant.getNextAction(context, {
      campaignId,
      countryCode,
      status,
      excludeMemberIds: excludeMemberId ? [excludeMemberId] : undefined,
    });

    if (!action) {
      return withLinkedInAssistantCors(
        NextResponse.json({ action: null, message: "No hay acciones pendientes" }),
        request,
      );
    }
    return withLinkedInAssistantCors(NextResponse.json({ action }), request);
  } catch (error) {
    return withLinkedInAssistantCors(linkedInAssistantApiError(error), request);
  }
}
