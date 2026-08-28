import { beginIdempotency, completeIdempotency, failIdempotency, requestFingerprint } from "@/lib/public-api/idempotency";
import { createPublicNotification } from "@/lib/public-api/notifications";
import { toPublicApiContext, type McpAuthContext } from "@/mcp/auth/context";
import { publicOrMcpError, McpToolError } from "@/mcp/errors";
import { prepareEmail, prepareWhatsapp } from "@/mcp/services/prepare";
import { parseOrThrow, sendEmailSchema, sendWhatsappSchema } from "@/mcp/tools/schemas";

async function sendWithIdempotency(
  ctx: McpAuthContext,
  tool: "send_whatsapp" | "send_email",
  idempotencyKey: string,
  body: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const fingerprint = requestFingerprint({ tool, body });
  const begun = await beginIdempotency({
    orgId: ctx.orgId,
    environment: "mcp",
    key: `${tool}:${idempotencyKey}`,
    fingerprint,
  });
  if (begun.replay) {
    const replayed = begun.replay.body;
    if (replayed && typeof replayed === "object") return replayed as Record<string, unknown>;
  }
  try {
    const result = await createPublicNotification(toPublicApiContext(ctx), body);
    const out = {
      ...result.body,
      source: "mcp",
      client: ctx.mcpClient,
    };
    await completeIdempotency(begun.docId, result.httpStatus, out);
    return out;
  } catch (e) {
    await failIdempotency(begun.docId);
    throw publicOrMcpError(e);
  }
}

export async function sendWhatsapp(ctx: McpAuthContext, raw: unknown): Promise<Record<string, unknown>> {
  const input = parseOrThrow(sendWhatsappSchema, raw);
  const prepared = await prepareWhatsapp(ctx, {
    recipientPhone: input.recipientPhone,
    recipientName: input.recipientName,
    templateId: input.templateId,
    templateName: input.templateName,
    variables: input.variables,
    metadata: input.metadata,
  });
  if (!prepared.allowed) {
    throw new McpToolError("INSUFFICIENT_CREDITS", "The account has no remaining sends.", 422);
  }
  return sendWithIdempotency(ctx, "send_whatsapp", input.idempotencyKey, {
    channel: "whatsapp",
    recipient: {
      phone: input.recipientPhone,
      name: input.recipientName,
    },
    template: input.templateId || input.templateName,
    variables: input.variables,
    metadata: input.metadata,
  });
}

export async function sendEmail(ctx: McpAuthContext, raw: unknown): Promise<Record<string, unknown>> {
  const input = parseOrThrow(sendEmailSchema, raw);
  const prepared = await prepareEmail(ctx, {
    recipientEmail: input.recipientEmail,
    recipientName: input.recipientName,
    subject: input.subject,
    body: input.body,
    templateId: input.templateId,
    variables: input.variables,
    metadata: input.metadata,
  });
  if (!prepared.allowed) {
    throw new McpToolError("INSUFFICIENT_CREDITS", "The account has no remaining sends.", 422);
  }
  return sendWithIdempotency(ctx, "send_email", input.idempotencyKey, {
    channel: "email",
    recipient: {
      email: input.recipientEmail,
      name: input.recipientName,
    },
    subject: input.subject,
    body: input.body,
    template: input.templateId,
    variables: input.variables,
    metadata: input.metadata,
  });
}
