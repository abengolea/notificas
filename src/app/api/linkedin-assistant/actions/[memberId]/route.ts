import { NextRequest, NextResponse } from "next/server";
import {
  assertLinkedInAssistant,
  linkedInAssistantApiError,
  linkedInAssistantRuntime,
  withLinkedInAssistantCors,
} from "../../_shared";

export async function OPTIONS(request: NextRequest) {
  return withLinkedInAssistantCors(new NextResponse(null, { status: 204 }), request);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ memberId: string }> },
) {
  const denied = assertLinkedInAssistant(request);
  if (denied) return withLinkedInAssistantCors(denied, request);
  try {
    const { memberId } = await params;
    const { assistant, context } = linkedInAssistantRuntime(request);
    const action = await assistant.getAction(context, memberId);
    return withLinkedInAssistantCors(NextResponse.json({ action }), request);
  } catch (error) {
    return withLinkedInAssistantCors(linkedInAssistantApiError(error), request);
  }
}
