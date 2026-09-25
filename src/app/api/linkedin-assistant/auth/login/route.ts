import { NextRequest, NextResponse } from "next/server";
import { getAdminPanelConfig } from "@/lib/admin-session";
import { withLinkedInAssistantCors } from "../../_shared";
import { issueExtensionSession, passwordsEqual } from "@/lib/marketing/linkedin-assistant-tokens";
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

  let body: { email?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return withLinkedInAssistantCors(
      NextResponse.json({ error: "invalid_json", message: "Solicitud inválida." }, { status: 400 }),
      request,
    );
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password.trim() : "";

  if (!email || !password || email !== cfg.email || !passwordsEqual(password, cfg.password)) {
    return withLinkedInAssistantCors(
      NextResponse.json(
        { error: "invalid_credentials", message: "Email o contraseña incorrectos." },
        { status: 401 },
      ),
      request,
    );
  }

  const session = issueExtensionSession(email, cfg.secret);
  return withLinkedInAssistantCors(
    NextResponse.json({
      ...session,
      environment: process.env.NODE_ENV === "production" ? "production" : "development",
      workspaceId: getMarketingWorkspaceId(),
    }),
    request,
  );
}
