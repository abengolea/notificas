import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { assertAdminSession } from "@/lib/assert-admin-session";
import { linkedInAdminRuntime, linkedInApiError } from "../_shared";

const createSchema = z.object({
  name: z.string().min(2).max(160),
  description: z.string().max(4000).optional(),
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

const statusSchema = z.enum(["draft", "active", "paused", "completed", "archived"]);
const archivedSchema = z.enum(["exclude", "include", "only"]);

export async function GET(request: NextRequest) {
  const denied = assertAdminSession(request);
  if (denied) return denied;
  try {
    const statusValue = request.nextUrl.searchParams.get("status");
    const status = statusValue ? statusSchema.safeParse(statusValue) : null;
    if (status && !status.success) {
      return NextResponse.json({ error: "Estado inválido" }, { status: 400 });
    }
    const archivedValue = request.nextUrl.searchParams.get("archived");
    const archived = archivedValue ? archivedSchema.safeParse(archivedValue) : null;
    if (archived && !archived.success) {
      return NextResponse.json({ error: "Filtro archived inválido" }, { status: 400 });
    }
    const { service, context } = linkedInAdminRuntime();
    const page = await service.searchCampaigns(context, {
      query: request.nextUrl.searchParams.get("q") || undefined,
      status: status?.success ? status.data : undefined,
      countryCode: request.nextUrl.searchParams.get("countryCode") || undefined,
      archived: archived?.success ? archived.data : undefined,
      cursor: request.nextUrl.searchParams.get("cursor") || undefined,
      limit: Number(request.nextUrl.searchParams.get("limit") || 50),
    });
    return NextResponse.json({ campaigns: page.items, nextCursor: page.nextCursor || null });
  } catch (error) {
    return linkedInApiError(error);
  }
}

export async function POST(request: NextRequest) {
  const denied = assertAdminSession(request);
  if (denied) return denied;
  try {
    const parsed = createSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const { service, context } = linkedInAdminRuntime();
    const campaign = await service.createCampaign(context, parsed.data);
    return NextResponse.json({ campaign }, { status: 201 });
  } catch (error) {
    return linkedInApiError(error);
  }
}
