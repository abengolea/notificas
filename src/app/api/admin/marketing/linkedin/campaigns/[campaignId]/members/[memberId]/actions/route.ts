import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { assertAdminSession } from "@/lib/assert-admin-session";
import { linkedInAdminRuntime, linkedInApiError } from "../../../../../_shared";

const actionSchema = z.object({
  action: z.enum([
    "connection_sent",
    "connected",
    "message_sent",
    "followup_sent",
    "replied",
    "interested",
    "not_interested",
  ]),
  at: z.string().datetime().optional(),
  nextActionAt: z.string().datetime().nullable().optional(),
  notes: z.string().max(8000).optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ campaignId: string; memberId: string }> },
) {
  const denied = assertAdminSession(request);
  if (denied) return denied;
  try {
    const parsed = actionSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const { campaignId, memberId } = await params;
    const { service, context } = linkedInAdminRuntime();
    const member = await service.recordAction(context, campaignId, memberId, parsed.data);
    return NextResponse.json({ member });
  } catch (error) {
    return linkedInApiError(error);
  }
}
