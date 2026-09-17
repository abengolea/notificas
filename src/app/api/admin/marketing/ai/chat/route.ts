import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { assertAdminSession, getAdminSessionEmail } from "@/lib/assert-admin-session";
import { crmAiEnabled } from "@/lib/marketing/flags";
import { getMarketingWorkspaceId } from "@/lib/marketing/workspace";
import { getLiveCrmToolRuntime } from "@/lib/marketing/tools/runtime";
import { crmAiStatus, geminiApiKey, CRM_AI_RATE_PER_MINUTE } from "@/lib/marketing/ai/config";
import { createLiveConversationStore } from "@/lib/marketing/ai/conversations";
import { liveGeminiPort } from "@/lib/marketing/ai/gemini";
import { runCrmAssistantTurn } from "@/lib/marketing/ai/loop";
import { consumeAiRateLimit } from "@/lib/marketing/ai/rate-limit";
import { writeCrmAiAudit } from "@/lib/marketing/ai/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const bodySchema = z.object({
  conversationId: z.string().max(80).optional(),
  message: z.string().min(1).max(8000),
});

export async function POST(request: NextRequest) {
  const denied = assertAdminSession(request);
  if (denied) return denied;
  const userId = getAdminSessionEmail(request);
  if (!userId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  if (!crmAiEnabled()) {
    return NextResponse.json({ error: "El asistente IA no está habilitado.", code: "CRM_AI_DISABLED" }, { status: 404 });
  }
  if (!geminiApiKey()) {
    return NextResponse.json(
      { error: "Asistente IA no configurado", code: "AI_NOT_CONFIGURED" },
      { status: 503 },
    );
  }

  const limited = consumeAiRateLimit(userId, CRM_AI_RATE_PER_MINUTE);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Demasiadas consultas al asistente. Probá en un momento.", retryAfterSec: limited.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Mensaje inválido" }, { status: 400 });
  }

  const workspaceId = getMarketingWorkspaceId();
  const store = createLiveConversationStore();
  let conversationId = parsed.data.conversationId;
  if (conversationId) {
    const existing = await store.get(conversationId, workspaceId, userId);
    if (!existing) conversationId = undefined;
  }
  if (!conversationId) {
    const created = await store.create({
      workspaceId,
      userId,
      title: parsed.data.message.replace(/\s+/g, " ").slice(0, 80),
    });
    conversationId = created.id;
  }

  try {
    const result = await runCrmAssistantTurn({
      runtime: getLiveCrmToolRuntime(),
      llm: liveGeminiPort(),
      conversations: store,
      ai: {
        workspaceId,
        userId,
        actorType: "ai",
        actorId: `ai:${userId}`,
        conversationId,
      },
      message: parsed.data.message,
      audit: writeCrmAiAudit,
    });
    return NextResponse.json(result);
  } catch (e) {
    console.error("crm ai chat", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "No se pudo completar la consulta al CRM." }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const denied = assertAdminSession(request);
  if (denied) return denied;
  return NextResponse.json(crmAiStatus());
}
