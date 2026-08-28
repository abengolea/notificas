import { z } from "zod";
import {
  isValidEmail,
  normalizePhoneOrError,
  sanitizeMetadata,
  sanitizeVariables,
} from "@/lib/public-api/validation";
import { McpToolError } from "@/mcp/errors";
import { MAX_MCP_DRAFT_INLINE_RECIPIENTS } from "@/mcp/config";

const metadataSchema = z
  .record(z.string().max(40), z.union([z.string().max(200), z.number(), z.boolean()]))
  .optional()
  .refine((v) => !v || Object.keys(v).length <= 20, { message: "metadata cannot have more than 20 keys" });

const variablesSchema = z
  .record(z.string().max(40), z.string().max(500))
  .optional()
  .refine((v) => !v || Object.keys(v).length <= 20, { message: "variables cannot have more than 20 keys" });

export const estimateSchema = z
  .object({
    channel: z.enum(["whatsapp", "email"]),
    quantity: z.number().int().min(1).max(5000),
    type: z.enum(["notification", "campaign_draft"]).optional(),
  })
  .strict();

export const prepareWhatsappSchema = z
  .object({
    recipientPhone: z.string().trim().min(6).max(32),
    recipientName: z.string().trim().min(1).max(120).optional(),
    templateId: z.string().trim().min(1).max(128).optional(),
    templateName: z.string().trim().min(1).max(128).optional(),
    variables: variablesSchema,
    metadata: metadataSchema,
  })
  .strict();

export const sendWhatsappSchema = prepareWhatsappSchema
  .extend({
    idempotencyKey: z.string().trim().min(1).max(256),
  })
  .strict();

export const prepareEmailSchema = z
  .object({
    recipientEmail: z.string().trim().min(5).max(254),
    recipientName: z.string().trim().min(1).max(120).optional(),
    subject: z.string().trim().min(1).max(300),
    body: z.string().trim().min(1).max(20000),
    templateId: z.string().trim().min(1).max(128).optional(),
    variables: variablesSchema,
    metadata: metadataSchema,
  })
  .strict();

export const sendEmailSchema = prepareEmailSchema
  .extend({
    idempotencyKey: z.string().trim().min(1).max(256),
  })
  .strict();

export const notificationIdSchema = z
  .object({
    notificationId: z.string().trim().min(6).max(128),
  })
  .strict();

const draftRecipientSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    phone: z.string().trim().max(32).optional(),
    email: z.string().trim().max(254).optional(),
    document: z.string().trim().max(20).optional(),
  })
  .strict();

export const createCampaignDraftSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    channel: z.enum(["whatsapp", "email"]),
    subject: z.string().trim().min(1).max(300).optional(),
    body: z.string().trim().max(20000).optional(),
    templateId: z.string().trim().min(1).max(128).optional(),
    recipientListId: z.string().trim().min(6).max(128).optional(),
    recipients: z.array(draftRecipientSchema).max(MAX_MCP_DRAFT_INLINE_RECIPIENTS).optional(),
    metadata: metadataSchema,
  })
  .strict();

export const campaignIdSchema = z
  .object({
    campaignId: z.string().trim().min(6).max(128),
  })
  .strict();

export function parseOrThrow<T>(schema: z.ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input ?? {});
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new McpToolError(
      "VALIDATION_ERROR",
      issue?.message || "Invalid arguments.",
      400,
      issue?.path.join(".") || undefined
    );
  }
  return parsed.data;
}

export function requirePhone(raw: string): string {
  const n = normalizePhoneOrError(raw);
  if (!n.ok) throw new McpToolError("INVALID_RECIPIENT", "The recipient phone number is invalid.", 400, "recipientPhone");
  return n.phone;
}

export function requireEmail(raw: string): string {
  if (!isValidEmail(raw)) {
    throw new McpToolError("INVALID_RECIPIENT", "The recipient email is invalid.", 400, "recipientEmail");
  }
  return raw.trim().toLowerCase();
}

export { sanitizeMetadata, sanitizeVariables };
