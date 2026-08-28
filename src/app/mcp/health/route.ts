import { MCP_SERVER_VERSION } from "@/mcp/config";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({
    ok: true,
    service: "notificas-mcp",
    version: MCP_SERVER_VERSION,
  });
}
