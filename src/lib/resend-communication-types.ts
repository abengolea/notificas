import type { MetaVerifyStatus } from "@/lib/meta-verify-status";

export type ResendEventKind =
  | "sent"
  | "delivered"
  | "delayed"
  | "bounced"
  | "failed"
  | "complained"
  | "opened"
  | "clicked"
  | "suppressed"
  | "other";

export type HistoricalResendEvent = {
  status: MetaVerifyStatus;
  kind: ResendEventKind;
  title: string;
  claim: string;
  source: "resend_webhook_historical" | "provider_events" | "mail_transport";
  emailId: string | null;
  smtpMessageId: string | null;
  recipient: string | null;
  providerTimestamp: string | null;
  receivedAt: string | null;
  rawPreserved: boolean;
  rawTruncated: boolean;
  signatureHeaderPresent: boolean;
  signatureValidation: "correct" | "incorrect" | "not_available" | "ingest_only";
  payloadSha256: string | null;
  integrityMatchesStoredHash: boolean | null;
  webhookAuthLabel: string;
  rawPublic: "omitted_sensitive" | "hash_only" | "none";
  evidentiaryClass: string;
};

export type ResendLiveEmail = {
  status: MetaVerifyStatus;
  message: string;
  queriedAt: string | null;
  emailId: string | null;
  lastEvent: string | null;
  createdAt: string | null;
  subject: string | null;
  from: string | null;
  to: string | null;
};

export type ResendCommunicationReport = {
  channel: "email" | "none";
  documentUnaffectedByLiveOutage: true;
  liveUnavailable: null | {
    status: "API_UNAVAILABLE";
    message: string;
  };
  live: {
    email: ResendLiveEmail | null;
    lastLiveCheckAt: string | null;
  };
  identification: {
    notificationId: string;
    campaignId: string | null;
    campaignMessageId: string | null;
    emailId: string | null;
    smtpMessageId: string | null;
    recipientEmail: string | null;
    subject: string | null;
  };
  inconsistencies: Array<{ code: string; message: string; status: MetaVerifyStatus }>;
  chronology: HistoricalResendEvent[];
  disclaimer: string;
};
