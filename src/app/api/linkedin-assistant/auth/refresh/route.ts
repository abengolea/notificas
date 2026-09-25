import { NextRequest, NextResponse } from "next/server";
import { getAdminPanelConfig } from "@/lib/admin-session";
import { withLinkedInAssistantCors } from "../../_shared";
import {
  EXTENSION_REFRESH_TYP,
  issueExtensionSession,
  verifyExtensionToken,
} from "@/lib/marketing/linkedin-assistant-tokens";
import { getMarketingWorkspaceId } from "@/lib/marketing/workspace";

export async function OPTIONS(request: NextRequest) {
  return withLinkedInAssistantCors(new NextResponse(null, { status: 204 }), request);
}

export async function POST(request: NextRequest) {
  const cfg = getAdminPanelConfig();
  if (!cfg) {
    return withLinkedInAssistantCors(
      NextResponse.json(
        {
          error: "auth_not_configured",
          message: "El servidor no tiene autenticación de extensión configurada.",
        },
        { status: 503 },
      ),
      request,
    );
  }

  let body: { refreshToken?: string };
  try {
    body = await request.json();
  } catch {
    return withLinkedInAssistantCors(
      NextResponse.json({ error: "invalid_json", message: "Solicitud inválida." }, { status: 400 }),
      request,
    );
  }

  const refreshToken = typeof body.refreshToken === "string" ? body.refreshToken.trim() : "";
  const verified = refreshToken
    ? verifyExtensionToken(refreshToken, cfg.secret, EXTENSION_REFRESH_TYP)
    : { ok: false as const, reason: "invalid" as const };

  if (!verified.ok) {
    return withLinkedInAssistantCors(
      NextResponse.json(
        {
          error: "session_expired",
          message: "Tu sesión venció. Volvé a iniciar sesión.",
        },
        { status: 401 },
      ),
      request,
    );
  }

  const session = issueExtensionSession(verified.payload.e, cfg.secret);
  return withLinkedInAssistantCors(
    NextResponse.json({
      ...session,
      environment: process.env.NODE_ENV === "production" ? "production" : "development",
      workspaceId: getMarketingWorkspaceId(),
    }),
    request,
  );
}
