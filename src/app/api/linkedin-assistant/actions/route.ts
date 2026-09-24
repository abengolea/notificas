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
    const dueBefore = params.get("dueBefore") || undefined;
    if (dueBefore && Number.isNaN(Date.parse(dueBefore))) {
      return withLinkedInAssistantCors(
        NextResponse.json({ error: "dueBefore inválido" }, { status: 400 }),
        request,
      );
    }
    const limit = Math.min(500, Math.max(1, Number(params.get("limit") || 100)));

    const { assistant, context } = linkedInAssistantRuntime(request);
    const actions = await assistant.listActions(context, {
      campaignId,
      countryCode,
      status,
      dueBefore,
      limit,
    });
    return withLinkedInAssistantCors(NextResponse.json({ actions, count: actions.length }), request);
  } catch (error) {
    return withLinkedInAssistantCors(linkedInAssistantApiError(error), request);
  }
}
