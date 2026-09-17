import { NextRequest, NextResponse } from "next/server";
import { assertAdminSession } from "@/lib/assert-admin-session";
import { crmAiStatus } from "@/lib/marketing/ai/config";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const denied = assertAdminSession(request);
  if (denied) return denied;
  return NextResponse.json(crmAiStatus());
}
