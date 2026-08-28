import type { PublicApiScope } from "@/lib/public-api/scopes";
import type { PublicCertificateStatus, PublicNotificationStatus } from "@/lib/public-api/status";

export type ApiEnvironment = "live" | "test";

export type ApiKeyRecord = {
  id: string;
  orgId: string;
  name: string;
  prefix: string;
  keyHash: string;
  environment: ApiEnvironment;
  scopes: PublicApiScope[];
  status: "active" | "revoked";
  createdAt: unknown;
  lastUsedAt: unknown | null;
  createdBy: string;
};

export type PublicApiAuthContext = {
  requestId: string;
  apiKeyId: string;
  apiKeyPrefix: string;
  orgId: string;
  orgName: string;
  orgCuit: string | null;
  senderUid: string;
  senderEmail: string;
  environment: ApiEnvironment;
  testMode: boolean;
  scopes: PublicApiScope[];
};

export type ApiNotificationRecord = {
  id: string;
  orgId: string;
  mailId: string;
  campaignId?: string | null;
  campaignMessageId?: string | null;
  batchId?: string | null;
  channel: "whatsapp" | "email";
  status: PublicNotificationStatus;
  reference: string | null;
  recipientPhone?: string;
  recipientEmail?: string;
  recipientName?: string;
  createdAt: unknown;
  sentAt?: unknown;
  deliveredAt?: unknown;
  readAt?: unknown;
  failedAt?: unknown;
  certificateStatus: PublicCertificateStatus;
  testMode: boolean;
  apiKeyId: string;
  requestId?: string;
};

export const COLLECTIONS = {
  apiKeys: "api_keys",
  apiNotifications: "api_notifications",
  apiBatches: "api_batches",
  apiIdempotency: "api_idempotency",
  apiAudit: "api_audit_logs",
  apiRateLimits: "api_rate_limits",
  webhookEndpoints: "webhook_endpoints",
  webhookEvents: "webhook_events",
  webhookDeliveries: "webhook_deliveries",
} as const;
