import { handleMcpHttp, mcpCorsHeaders, mcpDisabledResponse } from "@/mcp/server";
import { mcpEnabled } from "@/mcp/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: mcpCorsHeaders() });
}

export async function GET(request: Request) {
  if (!mcpEnabled()) return mcpDisabledResponse();
  return handleMcpHttp(request);
}

export async function POST(request: Request) {
  return handleMcpHttp(request);
}

export async function DELETE(request: Request) {
  return handleMcpHttp(request);
}
