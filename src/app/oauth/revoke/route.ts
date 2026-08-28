import { revokeToken } from "@/mcp/auth/tokens";
import { oauthCorsResponse, oauthOptions, readFormOrJson, requireMcpOauth } from "@/mcp/auth/http";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return oauthOptions();
}

export async function POST(request: Request) {
  const disabled = requireMcpOauth();
  if (disabled) return disabled;
  const body = await readFormOrJson(request);
  await revokeToken(body.token || "");
  return oauthCorsResponse({ revoked: true }, 200);
}
