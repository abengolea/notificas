import { NextRequest, NextResponse } from "next/server";
import { assertAdminSession } from "@/lib/assert-admin-session";
import { linkedInAdminRuntime, linkedInApiError } from "../../_shared";

export async function GET(request: NextRequest) {
  const denied = assertAdminSession(request);
  if (denied) return denied;
  try {
    const dueBefore = request.nextUrl.searchParams.get("dueBefore") || new Date().toISOString();
    if (Number.isNaN(Date.parse(dueBefore))) {
      return NextResponse.json({ error: "dueBefore inválido" }, { status: 400 });
    }
    const limit = Math.min(500, Math.max(1, Number(request.nextUrl.searchParams.get("limit") || 100)));
    const { service, context } = linkedInAdminRuntime();
    const page = await service.pendingActions(context, new Date(dueBefore).toISOString(), limit);
    return NextResponse.json({ members: page.items, nextCursor: page.nextCursor || null });
  } catch (error) {
    return linkedInApiError(error);
  }
}
