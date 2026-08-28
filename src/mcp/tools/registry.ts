import type { McpScope } from "@/mcp/scopes";
import { annotationsFor, type McpToolKind } from "@/mcp/protocol";
import type { McpAuthContext } from "@/mcp/auth/context";
import { requireScope } from "@/mcp/auth/context";
import { getAccount, getBalance } from "@/mcp/services/account";
import { estimateNotification, prepareEmail, prepareWhatsapp } from "@/mcp/services/prepare";
import { sendEmail, sendWhatsapp } from "@/mcp/services/send";
import { getCertificate, getDeliveryStatus, getNotification, verifyNotification } from "@/mcp/services/lookup";
import { createCampaignDraft, getCampaignStatus } from "@/mcp/services/campaigns";
import { McpToolError } from "@/mcp/errors";
import { isForbiddenMcpTool } from "@/mcp/tools/policy";

export type RegisteredTool = {
  name: string;
  description: string;
  kind: McpToolKind;
  scope: McpScope;
  consumesCredits: boolean;
  sideEffect: boolean;
  inputSchema: Record<string, unknown>;
  handler: (ctx: McpAuthContext, args: unknown) => Promise<unknown>;
};

const phoneProps = {
  recipientPhone: { type: "string", minLength: 6, maxLength: 32, description: "Recipient mobile number in international format." },
  recipientName: { type: "string", maxLength: 120 },
  templateId: { type: "string", maxLength: 128, description: "Saved WhatsApp template id or name in this Notificas account." },
  templateName: { type: "string", maxLength: 128 },
  variables: { type: "object", additionalProperties: { type: "string", maxLength: 500 } },
  metadata: { type: "object", additionalProperties: { type: ["string", "number", "boolean"] } },
};

const emailProps = {
  recipientEmail: { type: "string", format: "email", maxLength: 254 },
  recipientName: { type: "string", maxLength: 120 },
  subject: { type: "string", minLength: 1, maxLength: 300 },
  body: { type: "string", minLength: 1, maxLength: 20000 },
  templateId: { type: "string", maxLength: 128 },
  variables: { type: "object", additionalProperties: { type: "string", maxLength: 500 } },
  metadata: { type: "object", additionalProperties: { type: ["string", "number", "boolean"] } },
};

export const MCP_TOOLS: RegisteredTool[] = [
  {
    name: "get_account",
    description:
      "Return the authenticated Notificas company (name, plan) and granted OAuth scopes. Read-only. Never returns secrets, API keys or credentials.",
    kind: "read",
    scope: "account:read",
    consumesCredits: false,
    sideEffect: false,
    inputSchema: { type: "object", additionalProperties: false, properties: {} },
    handler: (ctx) => getAccount(ctx),
  },
  {
    name: "get_balance",
    description:
      "Return the real Notificas send credit balance of the authenticated account. Read-only. Does not compute a parallel balance.",
    kind: "read",
    scope: "account:read",
    consumesCredits: false,
    sideEffect: false,
    inputSchema: { type: "object", additionalProperties: false, properties: {} },
    handler: (ctx) => getBalance(ctx),
  },
  {
    name: "estimate_notification",
    description:
      "Estimate how many Notificas credits a WhatsApp or email operation would consume before sending. Uses the same internal pricing rules as the product. Does not send anything.",
    kind: "prepare",
    scope: "notifications:prepare",
    consumesCredits: false,
    sideEffect: false,
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["channel", "quantity"],
      properties: {
        channel: { type: "string", enum: ["whatsapp", "email"] },
        quantity: { type: "integer", minimum: 1, maximum: 5000 },
        type: { type: "string", enum: ["notification", "campaign_draft"] },
      },
    },
    handler: (ctx, args) => estimateNotification(ctx, args),
  },
  {
    name: "prepare_whatsapp",
    description:
      "Validate and preview one certified WhatsApp notification for the authenticated Notificas account without sending it. Checks phone, template, variables, permissions and credit balance. Never use this to send.",
    kind: "prepare",
    scope: "notifications:prepare",
    consumesCredits: false,
    sideEffect: false,
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["recipientPhone"],
      properties: phoneProps,
    },
    handler: (ctx, args) => prepareWhatsapp(ctx, args),
  },
  {
    name: "send_whatsapp",
    description:
      "Send one certified transactional WhatsApp notification through the authenticated Notificas account. This operation has an external side effect, consumes Notificas credits and is recorded as legal evidence. Use prepare_whatsapp first whenever possible. Maximum one recipient per call. Never use for bulk campaigns. Requires idempotencyKey.",
    kind: "write",
    scope: "notifications:send",
    consumesCredits: true,
    sideEffect: true,
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["recipientPhone", "idempotencyKey"],
      properties: {
        ...phoneProps,
        idempotencyKey: {
          type: "string",
          minLength: 1,
          maxLength: 256,
          description: "Caller-generated key to prevent duplicate sends on retries.",
        },
      },
    },
    handler: (ctx, args) => sendWhatsapp(ctx, args),
  },
  {
    name: "prepare_email",
    description:
      "Validate and preview one certified email notification for the authenticated Notificas account without sending it. Checks email, content, permissions and credit balance.",
    kind: "prepare",
    scope: "notifications:prepare",
    consumesCredits: false,
    sideEffect: false,
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["recipientEmail", "subject", "body"],
      properties: emailProps,
    },
    handler: (ctx, args) => prepareEmail(ctx, args),
  },
  {
    name: "send_email",
    description:
      "Send one certified transactional email through the authenticated Notificas account (Resend via existing Notificas services). This operation has an external side effect, consumes Notificas credits and preserves the same evidence as the web app. Use prepare_email first whenever possible. Maximum one recipient per call. Never use for bulk campaigns. Requires idempotencyKey.",
    kind: "write",
    scope: "notifications:send",
    consumesCredits: true,
    sideEffect: true,
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["recipientEmail", "subject", "body", "idempotencyKey"],
      properties: {
        ...emailProps,
        idempotencyKey: {
          type: "string",
          minLength: 1,
          maxLength: 256,
          description: "Caller-generated key to prevent duplicate sends on retries.",
        },
      },
    },
    handler: (ctx, args) => sendEmail(ctx, args),
  },
  {
    name: "get_notification",
    description:
      "Get a notification that belongs to the authenticated Notificas account. Returns masked recipient, channel, timestamps, status and whether a constancia exists. Foreign notification IDs are not found.",
    kind: "read",
    scope: "notifications:read",
    consumesCredits: false,
    sideEffect: false,
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["notificationId"],
      properties: { notificationId: { type: "string", minLength: 6, maxLength: 128 } },
    },
    handler: (ctx, args) => getNotification(ctx, args),
  },
  {
    name: "get_delivery_status",
    description:
      "Return the normalized delivery status (queued, sent, delivered, read, failed) of a notification owned by the authenticated account, using Meta and Resend webhook data already stored by Notificas.",
    kind: "read",
    scope: "notifications:read",
    consumesCredits: false,
    sideEffect: false,
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["notificationId"],
      properties: { notificationId: { type: "string", minLength: 6, maxLength: 128 } },
    },
    handler: (ctx, args) => getDeliveryStatus(ctx, args),
  },
  {
    name: "get_certificate",
    description:
      "Return a short-lived signed URL for the constancia PDF of a notification owned by the authenticated account. Does not make private documents public. Does not return internal storage paths.",
    kind: "read",
    scope: "certificates:read",
    consumesCredits: false,
    sideEffect: false,
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["notificationId"],
      properties: { notificationId: { type: "string", minLength: 6, maxLength: 128 } },
    },
    handler: (ctx, args) => getCertificate(ctx, args),
  },
  {
    name: "verify_notification",
    description:
      "Return verifiable integrity data of a notification owned by the authenticated account: hashes, timestamps, WAMID/recipient_id when present, Polygon transaction if recorded, and the public verification URL.",
    kind: "read",
    scope: "certificates:read",
    consumesCredits: false,
    sideEffect: false,
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["notificationId"],
      properties: { notificationId: { type: "string", minLength: 6, maxLength: 128 } },
    },
    handler: (ctx, args) => verifyNotification(ctx, args),
  },
  {
    name: "create_campaign_draft",
    description:
      "Create a campaign draft in Notificas. This does not send messages and cannot start a mass campaign. Returns a review URL so a human can confirm in the authenticated Notificas UI. Maximum 200 inline recipients; larger audiences must reference an existing recipientListId.",
    kind: "prepare",
    scope: "campaigns:create",
    consumesCredits: false,
    sideEffect: false,
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["channel"],
      properties: {
        name: { type: "string", maxLength: 200 },
        channel: { type: "string", enum: ["whatsapp", "email"] },
        subject: { type: "string", maxLength: 300 },
        body: { type: "string", maxLength: 20000 },
        templateId: { type: "string", maxLength: 128 },
        recipientListId: { type: "string", maxLength: 128 },
        recipients: {
          type: "array",
          maxItems: 200,
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              name: { type: "string", maxLength: 120 },
              phone: { type: "string", maxLength: 32 },
              email: { type: "string", maxLength: 254 },
              document: { type: "string", maxLength: 20 },
            },
          },
        },
        metadata: { type: "object", additionalProperties: { type: ["string", "number", "boolean"] } },
      },
    },
    handler: (ctx, args) => createCampaignDraft(ctx, args),
  },
  {
    name: "get_campaign_status",
    description:
      "Read the status and metrics of a campaign owned by the authenticated Notificas account (draft, processing, completed, paused, failed). Read-only.",
    kind: "read",
    scope: "campaigns:read",
    consumesCredits: false,
    sideEffect: false,
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["campaignId"],
      properties: { campaignId: { type: "string", minLength: 6, maxLength: 128 } },
    },
    handler: (ctx, args) => getCampaignStatus(ctx, args),
  },
];

export function listToolsForScopes(scopes: readonly string[]) {
  return MCP_TOOLS.filter((t) => scopes.includes(t.scope) || scopes.includes("*")).map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema,
    annotations: annotationsFor(t.kind),
  }));
}

export function getToolOrThrow(name: string): RegisteredTool {
  if (isForbiddenMcpTool(name)) {
    throw new McpToolError(
      "FEATURE_NOT_AVAILABLE",
      "Mass sending from MCP is not available. Create a draft and confirm the campaign in the Notificas web app.",
      403
    );
  }
  const tool = MCP_TOOLS.find((t) => t.name === name);
  if (!tool) {
    throw new McpToolError("VALIDATION_ERROR", `Unknown tool: ${name}.`, 400);
  }
  return tool;
}

export async function callTool(ctx: McpAuthContext, name: string, args: unknown): Promise<{ tool: RegisteredTool; result: unknown }> {
  const tool = getToolOrThrow(name);
  requireScope(ctx, tool.scope);
  const result = await tool.handler(ctx, args ?? {});
  return { tool, result };
}

export { annotationsFor };
