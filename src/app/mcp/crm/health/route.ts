import { crmMcpHealthPayload } from "@/mcp/crm/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const body = crmMcpHealthPayload();
    return Response.json(
      {
        ok: body.enabled && body.ok,
        service: body.service,
        version: body.version,
        readOnly: false,
        sendForbidden: true,
        enabled: body.enabled,
        toolCount: body.toolCount,
        linkedinToolCount: body.linkedinToolCount,
      },
      { status: body.enabled ? 200 : 503 },
    );
}
