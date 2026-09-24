import { NextRequest, NextResponse } from "next/server";
import {
  assertLinkedInAssistant,
  linkedInAssistantApiError,
  linkedInAssistantRuntime,
  withLinkedInAssistantCors,
} from "../../../_shared";

export async function OPTIONS(request: NextRequest) {
  return withLinkedInAssistantCors(new NextResponse(null, { status: 204 }), request);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ memberId: string }> },
) {
  const denied = assertLinkedInAssistant(request);
  if (denied) return withLinkedInAssistantCors(denied, request);
  try {
    const { memberId } = await params;
    const body = await request.json();
    const { assistant, context } = linkedInAssistantRuntime(request);
    const result = await assistant.recordAuditEvent(context, memberId, body);
    return withLinkedInAssistantCors(NextResponse.json(result), request);
  } catch (error) {
    return withLinkedInAssistantCors(linkedInAssistantApiError(error), request);
  }
}
