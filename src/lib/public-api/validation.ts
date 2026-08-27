import { z } from "zod";
import { toWhatsAppPhone } from "@/lib/parse-campaign-csv";
import { PUBLIC_NOTIFICATION_STATUSES } from "@/lib/public-api/status";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TEMPLATE_RE = /^[a-z0-9_]{1,128}$/;
const ID_SAFE_RE = /^[a-zA-Z0-9_.:-]{1,128}$/;

export const MAX_NOTIFICATION_BODY_BYTES = 64 * 1024;
export const MAX_BATCH_BODY_BYTES = 1024 * 1024;
export const MAX_WEBHOOK_BODY_BYTES = 16 * 1024;
export const MAX_BATCH_RECIPIENTS = 5000;
export const MAX_METADATA_KEYS = 20;
export const MAX_VARIABLES = 20;

const metadataSchema = z
  .record(z.string().max(40), z.union([z.string().max(200), z.number(), z.boolean()]))
  .optional()
  .refine((v) => !v || Object.keys(v).length <= MAX_METADATA_KEYS, {
    message: `metadata cannot have more than ${MAX_METADATA_KEYS} keys`,
  });

const variablesSchema = z
  .record(z.string().max(40), z.string().max(500))
  .optional()
  .refine((v) => !v || Object.keys(v).length <= MAX_VARIABLES, {
    message: `variables cannot have more than ${MAX_VARIABLES} keys`,
  });

const recipientSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    phone: z.string().trim().max(32).optional(),
    email: z.string().trim().max(254).optional(),
    document: z.string().trim().max(20).optional(),
  })
  .strict();

export const createNotificationSchema = z
  .object({
    channel: z.enum(["whatsapp", "email"]),
    recipient: recipientSchema,
    template: z.string().trim().min(1).max(128).optional(),
    variables: variablesSchema,
    subject: z.string().trim().min(1).max(300).optional(),
    body: z.string().trim().min(1).max(20000).optional(),
    reference: z.string().trim().max(128).optional(),
    metadata: metadataSchema,
  })
  .strict();

export type CreateNotificationInput = z.infer<typeof createNotificationSchema>;

const batchRecipientSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    phone: z.string().trim().max(32).optional(),
    email: z.string().trim().max(254).optional(),
    document: z.string().trim().max(20).optional(),
    variables: variablesSchema,
    reference: z.string().trim().max(128).optional(),
    metadata: metadataSchema,
  })
  .strict();

export const createBatchSchema = z
  .object({
    channel: z.enum(["whatsapp", "email"]),
    template: z.string().trim().min(1).max(128).optional(),
    subject: z.string().trim().min(1).max(300).optional(),
    body: z.string().trim().max(20000).optional(),
    reference: z.string().trim().max(128).optional(),
    metadata: metadataSchema,
    recipients: z.array(batchRecipientSchema).min(1).max(MAX_BATCH_RECIPIENTS),
  })
  .strict();

export type CreateBatchInput = z.infer<typeof createBatchSchema>;

export const WEBHOOK_EVENT_TYPES = [
  "notification.queued",
  "notification.sent",
  "notification.delivered",
  "notification.read",
  "notification.failed",
  "notification.certificate_ready",
  "batch.completed",
] as const;

export type WebhookEventType = (typeof WEBHOOK_EVENT_TYPES)[number];

export const createWebhookEndpointSchema = z
  .object({
    url: z.string().trim().url().max(2048),
    events: z.array(z.enum(WEBHOOK_EVENT_TYPES)).min(1).max(WEBHOOK_EVENT_TYPES.length),
    description: z.string().trim().max(200).optional(),
  })
  .strict();

export const patchWebhookEndpointSchema = z
  .object({
    url: z.string().trim().url().max(2048).optional(),
    events: z.array(z.enum(WEBHOOK_EVENT_TYPES)).min(1).max(WEBHOOK_EVENT_TYPES.length).optional(),
    enabled: z.boolean().optional(),
    description: z.string().trim().max(200).optional(),
  })
  .strict();

export const listNotificationsQuerySchema = z.object({
  status: z.enum(PUBLIC_NOTIFICATION_STATUSES).optional(),
  channel: z.enum(["whatsapp", "email"]).optional(),
  reference: z.string().trim().max(128).optional(),
  created_from: z.string().datetime({ offset: true }).optional(),
  created_to: z.string().datetime({ offset: true }).optional(),
  recipient: z.string().trim().max(254).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  cursor: z.string().trim().max(512).optional(),
});

export function isValidEmail(value: string): boolean {
  const v = value.trim().toLowerCase();
  return v.length >= 5 && v.length <= 254 && EMAIL_RE.test(v);
}

export function isValidTemplateName(value: string): boolean {
  return TEMPLATE_RE.test(value.trim().toLowerCase());
}

export function isValidIdempotencyKey(value: string): boolean {
  return ID_SAFE_RE.test(value) || (value.length >= 1 && value.length <= 256 && /^[\x21-\x7E]+$/.test(value));
}

export function normalizePhoneOrError(raw: string | undefined): { ok: true; phone: string } | { ok: false } {
  if (!raw) return { ok: false };
  const phone = toWhatsAppPhone(raw);
  if (!phone) return { ok: false };
  return { ok: true, phone };
}

export function sanitizeMetadata(
  input: Record<string, string | number | boolean> | undefined
): Record<string, string> {
  if (!input) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(input)) {
    const key = k.trim().slice(0, 40);
    if (!key) continue;
    out[key] = String(v).slice(0, 200);
  }
  return out;
}

export function sanitizeVariables(input: Record<string, string> | undefined): Record<string, string> {
  if (!input) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(input)) {
    const key = k.trim().slice(0, 40);
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) continue;
    out[key] = String(v ?? "").replace(/[\u0000-\u001F]/g, "").slice(0, 500);
  }
  return out;
}
