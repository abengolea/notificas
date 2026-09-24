import { NextRequest, NextResponse } from "next/server";
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
    const countryCode = request.nextUrl.searchParams.get("countryCode") || undefined;
    const { assistant, context } = linkedInAssistantRuntime(request);
    const campaigns = await assistant.listCampaignSummaries(context, countryCode);
    return withLinkedInAssistantCors(NextResponse.json({ campaigns }), request);
  } catch (error) {
    return withLinkedInAssistantCors(linkedInAssistantApiError(error), request);
  }
}
