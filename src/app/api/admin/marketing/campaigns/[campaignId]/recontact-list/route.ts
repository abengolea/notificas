import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { assertAdminSession } from "@/lib/assert-admin-session";
import { MarketingError } from "@/lib/marketing/errors";
import { createLiveRecontactStore, createRecontactListFromCampaign } from "@/lib/marketing/recontact";

const postSchema = z.object({
  filter: z.literal("not_opened").optional().default("not_opened"),
  name: z.string().min(2).max(160).optional(),
  idempotencyKey: z.string().min(1).max(128),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> },
) {
  const denied = assertAdminSession(request);
  if (denied) return denied;
  const { campaignId } = await params;
  try {
    const parsed = postSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const result = await createRecontactListFromCampaign(createLiveRecontactStore(), {
      campaignId,
      filter: parsed.data.filter,
      name: parsed.data.name,
      idempotencyKey: parsed.data.idempotencyKey,
    });
    return NextResponse.json({ ...result, sent: false, campaignCreated: false }, { status: result.reused ? 200 : 201 });
  } catch (e) {
    const status =
      e instanceof MarketingError
        ? e.code === "not_found"
          ? 404
          : 400
        : 500;
    console.error("POST marketing recontact list", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error interno" }, { status });
  }
}
