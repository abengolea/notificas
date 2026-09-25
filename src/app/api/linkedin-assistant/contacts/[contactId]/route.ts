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
  { params }: { params: Promise<{ contactId: string }> },
) {
  const denied = assertLinkedInAssistant(request);
  if (denied) return withLinkedInAssistantCors(denied, request);
  try {
    const { contactId } = await params;
    const { assistant, context } = linkedInAssistantRuntime(request);
    const contact = await assistant.getContact(context, contactId);
    return withLinkedInAssistantCors(NextResponse.json({ contact }), request);
  } catch (error) {
    return withLinkedInAssistantCors(linkedInAssistantApiError(error), request);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ contactId: string }> },
) {
  const denied = assertLinkedInAssistant(request);
  if (denied) return withLinkedInAssistantCors(denied, request);
  try {
    const { contactId } = await params;
    const body = await request.json();
    const { assistant, context } = linkedInAssistantRuntime(request);
    const contact = await assistant.updateAllowedContact(context, contactId, body);
    return withLinkedInAssistantCors(NextResponse.json({ contact }), request);
  } catch (error) {
    return withLinkedInAssistantCors(linkedInAssistantApiError(error), request);
  }
}
