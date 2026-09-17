import { marketingContext } from "../context";
import { executeCrmTool } from "../tools/execute";
import { internalAiToolDefinitions } from "../tools/registry";
import type { CrmToolContext, CrmToolResult, CrmToolRuntime } from "../tools/types";
import { writeCrmAiAudit, type CrmAiAuditEntry } from "./audit";
import { CRM_ASSISTANT_INSTRUCTIONS } from "./instructions";
import { CRM_AI_MAX_TOOL_ROUNDS, geminiCrmModel } from "./config";
import type { CrmLlmContent, CrmLlmPort, CrmLlmTool } from "./provider";
import { conversationWindow, type ConversationStore } from "./conversations";

export type MarketingAIContext = {
  workspaceId: string;
  userId: string;
  actorType: "ai";
  actorId: string;
  conversationId: string;
  requestId?: string;
};

export type CrmAiAction = {
  tool: string;
  summary: string;
  entityType?: string;
  entityIds?: string[];
  write: boolean;
  duplicateWarnings?: unknown;
  needsClarification?: boolean;
};

export type CrmAiTurnResult = {
  conversationId: string;
  message: string;
  actions: CrmAiAction[];
  usage: {
    model: string;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
};

function toLlmTools(): CrmLlmTool[] {
  return internalAiToolDefinitions().map((t) => ({
    name: t.name,
    description: t.description,
    parameters: t.inputSchema,
  }));
}

function addUsage(
  acc: { inputTokens: number; outputTokens: number; totalTokens: number },
  usage?: { input_tokens?: number; output_tokens?: number; total_tokens?: number },
) {
  acc.inputTokens += usage?.input_tokens || 0;
  acc.outputTokens += usage?.output_tokens || 0;
  acc.totalTokens += usage?.total_tokens || (usage?.input_tokens || 0) + (usage?.output_tokens || 0);
}

export async function runCrmAssistantTurn(opts: {
  runtime: CrmToolRuntime;
  llm: CrmLlmPort;
  conversations: ConversationStore;
  ai: MarketingAIContext;
  message: string;
  audit?: (entry: CrmAiAuditEntry) => Promise<void>;
}): Promise<CrmAiTurnResult> {
  const model = geminiCrmModel();
  const tools = toLlmTools();
  const existing = await opts.conversations.listMessages(opts.ai.conversationId);
  const history = conversationWindow(existing);
  const contents: CrmLlmContent[] = [
    ...history.map((m) => ({ role: m.role === "assistant" ? ("model" as const) : ("user" as const), text: m.content })),
    { role: "user", text: opts.message },
  ];

  const actions: CrmAiAction[] = [];
  const usage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
  let finalText = "";

  for (let round = 0; round < CRM_AI_MAX_TOOL_ROUNDS; round += 1) {
    const res = await opts.llm.generate({
      model,
      system: CRM_ASSISTANT_INSTRUCTIONS,
      contents,
      tools,
    });
    addUsage(usage, res.usage);
    if (!res.functionCalls.length) {
      finalText = res.text;
      break;
    }
    contents.push({ role: "model", functionCalls: res.functionCalls });
    const responses: Array<{ call_id: string; name: string; result: unknown }> = [];
    for (const call of res.functionCalls) {
      const started = Date.now();
      const toolCtx: CrmToolContext = {
        ...marketingContext(opts.ai.workspaceId, {
          actorType: "ai",
          actorId: opts.ai.actorId,
          idempotencyKey: call.call_id,
        }),
        userId: opts.ai.userId,
        conversationId: opts.ai.conversationId,
        requestId: opts.ai.requestId,
      };
      const result: CrmToolResult = await executeCrmTool({
        runtime: opts.runtime,
        ctx: toolCtx,
        name: call.name,
        args: call.arguments,
        mode: "readwrite",
      });
      const writer = opts.audit || writeCrmAiAudit;
      await writer({
        workspaceId: opts.ai.workspaceId,
        userId: opts.ai.userId,
        conversationId: opts.ai.conversationId,
        tool: call.name,
        entityType: result.ok ? result.entityType : undefined,
        entityIds: result.ok ? result.entityIds : undefined,
        success: result.ok,
        errorCode: result.ok ? undefined : result.error.code,
        durationMs: Date.now() - started,
        idempotencyKey: call.call_id,
        model,
      });
      if (result.ok) {
        actions.push({
          tool: call.name,
          summary: result.summary || call.name,
          entityType: result.entityType,
          entityIds: result.entityIds,
          write: result.write,
          duplicateWarnings: result.duplicateWarnings,
          needsClarification: result.needsClarification,
        });
      } else {
        actions.push({
          tool: call.name,
          summary: result.error.message,
          write: result.write,
        });
      }
      responses.push({ call_id: call.call_id, name: call.name, result });
    }
    contents.push({ role: "user", functionResponses: responses });
  }

  if (!finalText) {
    finalText = actions.length
      ? "Consulté el CRM pero alcancé el límite de pasos. Revisá las acciones y pedime que continúe si hace falta."
      : "No pude completar la respuesta. Intentá de nuevo.";
  }

  await opts.conversations.addMessage({
    conversationId: opts.ai.conversationId,
    role: "user",
    content: opts.message,
  });
  await opts.conversations.addMessage({
    conversationId: opts.ai.conversationId,
    role: "assistant",
    content: finalText,
    toolNames: actions.map((a) => a.tool),
  });
  await opts.conversations.touch(opts.ai.conversationId);

  return {
    conversationId: opts.ai.conversationId,
    message: finalText,
    actions,
    usage: { model, ...usage },
  };
}
