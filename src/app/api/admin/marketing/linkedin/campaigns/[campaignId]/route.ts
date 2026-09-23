import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { assertAdminSession } from "@/lib/assert-admin-session";
import { linkedInAdminRuntime, linkedInApiError } from "../../_shared";

const patchSchema = z.object({
  name: z.string().min(2).max(160).optional(),
  description: z.string().max(4000).optional(),
  status: z.enum(["draft", "active", "paused", "completed", "archived"]).optional(),
  countryCode: z.string().min(2).max(40).nullable().optional(),
  industryIds: z.array(z.string().min(1).max(128)).max(50).optional(),
  useCaseIds: z.array(z.string().min(1).max(128)).max(50).optional(),
  listId: z.string().min(1).max(128).optional(),
  commercialInitiativeId: z.string().min(1).max(128).optional(),
  messageType: z.enum(["connection_request", "direct_message", "multistep"]).optional(),
  connectionMessage: z.string().max(3000).optional(),
  message: z.string().max(8000).optional(),
  followUpMessage: z.string().max(8000).optional(),
  notes: z.string().max(8000).optional(),
});

type Params = { params: Promise<{ campaignId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const denied = assertAdminSession(request);
  if (denied) return denied;
  try {
    const { campaignId } = await params;
    const { service, context } = linkedInAdminRuntime();
    const campaign = await service.getCampaign(context, campaignId);
    const preview = await service.previewCampaign(context, campaignId);
    return NextResponse.json({ campaign, members: preview.members, summary: preview.summary });
  } catch (error) {
    return linkedInApiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const denied = assertAdminSession(request);
  if (denied) return denied;
  try {
    const parsed = patchSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const { campaignId } = await params;
    const { service, context } = linkedInAdminRuntime();
    const campaign = parsed.data.status === "archived"
      ? await service.archiveCampaign(context, campaignId)
      : await service.updateCampaign(context, campaignId, parsed.data);
    return NextResponse.json({ campaign });
  } catch (error) {
    return linkedInApiError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const denied = assertAdminSession(request);
  if (denied) return denied;
  try {
    const { campaignId } = await params;
    const { service, context } = linkedInAdminRuntime();
    const campaign = await service.archiveCampaign(context, campaignId);
    return NextResponse.json({ campaign });
  } catch (error) {
    return linkedInApiError(error);
  }
}
