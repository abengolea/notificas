import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { assertAdminSession } from "@/lib/assert-admin-session";
import { linkedInAdminRuntime, linkedInApiError } from "../../../../_shared";

const patchSchema = z.object({
  status: z.enum([
    "not_contacted", "connection_ready", "connection_sent", "connected", "message_ready",
    "message_sent", "follow_up_due", "follow_up_sent", "replied", "interested",
    "not_interested", "do_not_contact",
  ]).optional(),
  connectionMessage: z.string().max(3000).optional(),
  message: z.string().max(8000).optional(),
  followUpMessage: z.string().max(8000).optional(),
  notes: z.string().max(8000).optional(),
  nextActionAt: z.string().datetime().nullable().optional(),
});

type Params = { params: Promise<{ campaignId: string; memberId: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const denied = assertAdminSession(request);
  if (denied) return denied;
  try {
    const parsed = patchSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const { campaignId, memberId } = await params;
    const { service, context } = linkedInAdminRuntime();
    const member = await service.updateMember(context, campaignId, memberId, parsed.data);
    return NextResponse.json({ member });
  } catch (error) {
    return linkedInApiError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const denied = assertAdminSession(request);
  if (denied) return denied;
  try {
    const { campaignId, memberId } = await params;
    const { service, context } = linkedInAdminRuntime();
    await service.removeMember(context, campaignId, memberId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return linkedInApiError(error);
  }
}
