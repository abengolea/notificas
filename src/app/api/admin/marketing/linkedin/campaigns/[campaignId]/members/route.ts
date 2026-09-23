import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { assertAdminSession } from "@/lib/assert-admin-session";
import { linkedInAdminRuntime, linkedInApiError } from "../../../_shared";

const addSchema = z.object({
  contactId: z.string().min(1).max(128),
});
const statusSchema = z.enum([
  "not_contacted",
  "connection_ready",
  "connection_sent",
  "connected",
  "message_ready",
  "message_sent",
  "follow_up_due",
  "follow_up_sent",
  "replied",
  "interested",
  "not_interested",
  "do_not_contact",
]);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> },
) {
  const denied = assertAdminSession(request);
  if (denied) return denied;
  try {
    const rawStatus = request.nextUrl.searchParams.get("status");
    const status = rawStatus ? statusSchema.safeParse(rawStatus) : null;
    if (status && !status.success) {
      return NextResponse.json({ error: "Estado de miembro inválido" }, { status: 400 });
    }
    const { campaignId } = await params;
    const { service, context } = linkedInAdminRuntime();
    const page = await service.listMembers(context, campaignId, {
      status: status?.success ? status.data : undefined,
      cursor: request.nextUrl.searchParams.get("cursor") || undefined,
      limit: Number(request.nextUrl.searchParams.get("limit") || 50),
    });
    return NextResponse.json({ members: page.items, nextCursor: page.nextCursor || null });
  } catch (error) {
    return linkedInApiError(error);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> },
) {
  const denied = assertAdminSession(request);
  if (denied) return denied;
  try {
    const parsed = addSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const { campaignId } = await params;
    const { service, context } = linkedInAdminRuntime();
    const member = await service.addMember(context, campaignId, parsed.data.contactId);
    return NextResponse.json({ member }, { status: 201 });
  } catch (error) {
    return linkedInApiError(error);
  }
}
