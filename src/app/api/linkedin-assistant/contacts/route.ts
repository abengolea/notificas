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
    const linkedinUrl = request.nextUrl.searchParams.get("linkedinUrl") || undefined;
    const query = request.nextUrl.searchParams.get("q") || undefined;
    const { assistant, context } = linkedInAssistantRuntime(request);

    if (linkedinUrl) {
      const result = await assistant.lookupByLinkedInUrl(context, linkedinUrl);
      return withLinkedInAssistantCors(NextResponse.json(result), request);
    }

    if (query) {
      const result = await assistant.searchContacts(context, query);
      return withLinkedInAssistantCors(NextResponse.json(result), request);
    }

    return withLinkedInAssistantCors(
      NextResponse.json({ error: "Falta linkedinUrl o q" }, { status: 400 }),
      request,
    );
  } catch (error) {
    return withLinkedInAssistantCors(linkedInAssistantApiError(error), request);
  }
}
