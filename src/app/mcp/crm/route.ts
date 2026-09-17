import { handleCrmMcpHttp, crmMcpDisabledResponse } from "@/mcp/crm/server";
import { crmMcpEnabledSafe } from "@/mcp/crm/config";
import { mcpCorsHeaders } from "@/mcp/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: mcpCorsHeaders() });
}

export async function GET(request: Request) {
  if (!crmMcpEnabledSafe()) return crmMcpDisabledResponse();
  return handleCrmMcpHttp(request);
}

export async function POST(request: Request) {
  return handleCrmMcpHttp(request);
}

export async function DELETE(request: Request) {
  return handleCrmMcpHttp(request);
}
