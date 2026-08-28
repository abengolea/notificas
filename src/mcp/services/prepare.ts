import { PublicApiError } from "@/lib/public-api/errors";
import { peekAvailableCredits, creditsRequiredForNotification } from "@/lib/public-api/notifications";
import { missingTemplateVariables, resolveOrgTemplate } from "@/lib/public-api/templates";
import { maskEmail, maskPhone } from "@/lib/public-api/mask";
import type { McpAuthContext } from "@/mcp/auth/context";
import { McpToolError } from "@/mcp/errors";
import {
  parseOrThrow,
  estimateSchema,
  prepareEmailSchema,
  prepareWhatsappSchema,
  requireEmail,
  requirePhone,
  sanitizeMetadata,
  sanitizeVariables,
} from "@/mcp/tools/schemas";

function applyVariables(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => vars[key] ?? "");
}

export type PreparedNotification = {
  channel: "whatsapp" | "email";
  recipient: Record<string, string>;
  templateName: string;
  preview: { subject?: string; body?: string; variables: Record<string, string> };
  creditsNeeded: number;
  creditsAvailable: number;
  allowed: boolean;
  warnings: string[];
};

async function prepareCommon(
  ctx: McpAuthContext,
  channel: "whatsapp" | "email",
  opts: {
    phone?: string;
    email?: string;
    name?: string;
    template?: string;
    variables?: Record<string, string>;
    subject?: string;
    body?: string;
    metadata?: Record<string, string>;
  }
): Promise<PreparedNotification> {
  let tpl;
  try {
    tpl = await resolveOrgTemplate(ctx.orgId, opts.template, channel);
  } catch (e) {
    if (e instanceof PublicApiError) {
      throw new McpToolError("INVALID_TEMPLATE", e.message, 422, "templateId");
    }
    throw e;
  }

  const variables = sanitizeVariables(opts.variables);
  const name = opts.name?.trim() || variables.nombre || "Destinatario";
  const vars: Record<string, string> = {
    ...variables,
    nombre: variables.nombre || name,
    remitente: variables.remitente || ctx.orgName,
  };
  const missing = missingTemplateVariables(tpl.templateVariables, vars);
  if (channel === "whatsapp" && missing.length) {
    throw new McpToolError(
      "MISSING_TEMPLATE_VARIABLE",
      `Missing template variable(s): ${missing.join(", ")}.`,
      422,
      missing[0]
    );
  }

  const creditsNeeded = creditsRequiredForNotification(channel);
  const creditsAvailable = await peekAvailableCredits(ctx.senderUid);
  const warnings: string[] = [];
  if (creditsAvailable < creditsNeeded) {
    warnings.push("The account does not have enough credits to send this notification.");
  }
  if (channel === "email" && !opts.subject && !opts.body && !opts.template) {
    throw new McpToolError("VALIDATION_ERROR", "Email requires subject and body.", 400, "body");
  }

  const subject = opts.subject ? applyVariables(opts.subject, vars) : undefined;
  const body = opts.body ? applyVariables(opts.body, vars) : undefined;
  void sanitizeMetadata(opts.metadata as Record<string, string | number | boolean> | undefined);

  return {
    channel,
    recipient: {
      ...(opts.phone ? { phone: maskPhone(opts.phone) || opts.phone } : {}),
      ...(opts.email ? { email: maskEmail(opts.email) || opts.email } : {}),
      name,
    },
    templateName: tpl.templateName,
    preview: {
      ...(subject ? { subject } : {}),
      ...(body ? { body } : {}),
      variables: vars,
    },
    creditsNeeded,
    creditsAvailable,
    allowed: creditsAvailable >= creditsNeeded,
    warnings,
  };
}

export async function prepareWhatsapp(ctx: McpAuthContext, raw: unknown): Promise<PreparedNotification> {
  const input = parseOrThrow(prepareWhatsappSchema, raw);
  const phone = requirePhone(input.recipientPhone);
  return prepareCommon(ctx, "whatsapp", {
    phone,
    name: input.recipientName,
    template: input.templateId || input.templateName,
    variables: input.variables,
    metadata: input.metadata as Record<string, string> | undefined,
  });
}

export async function prepareEmail(ctx: McpAuthContext, raw: unknown): Promise<PreparedNotification> {
  const input = parseOrThrow(prepareEmailSchema, raw);
  const email = requireEmail(input.recipientEmail);
  return prepareCommon(ctx, "email", {
    email,
    name: input.recipientName,
    template: input.templateId,
    variables: input.variables,
    subject: input.subject,
    body: input.body,
    metadata: input.metadata as Record<string, string> | undefined,
  });
}

export async function estimateNotification(
  ctx: McpAuthContext,
  raw: unknown
): Promise<{
  creditsNeeded: number;
  creditsAvailable: number;
  allowed: boolean;
  channel: "whatsapp" | "email";
  quantity: number;
}> {
  const input = parseOrThrow(estimateSchema, raw);
  const per = creditsRequiredForNotification(input.channel);
  const creditsNeeded = per * input.quantity;
  const creditsAvailable = await peekAvailableCredits(ctx.senderUid);
  return {
    channel: input.channel,
    quantity: input.quantity,
    creditsNeeded,
    creditsAvailable,
    allowed: creditsAvailable >= creditsNeeded,
  };
}
