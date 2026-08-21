import type { MetaVerifyStatus } from "@/lib/meta-verify-status";

export type HistoricalMetaEvent = {
  status: MetaVerifyStatus;
  kind: "sent" | "delivered" | "read" | "failed" | "other";
  title: string;
  claim: string;
  source: "meta_webhook_historical" | "meta_send_response" | "evidence_snapshot";
  wamid: string | null;
  recipientId: string | null;
  metaTimestamp: string | null;
  receivedAt: string | null;
  rawPreserved: boolean;
  rawTruncated: boolean;
  signatureHeaderPresent: boolean;
  signatureValidation: "correct" | "incorrect" | "not_available" | "ingest_only";
  payloadSha256: string | null;
  integrityMatchesStoredHash: boolean | null;
  webhookAuthLabel: string;
  rawPublic: "omitted_sensitive" | "omitted_unauthenticated" | "hash_only" | "none";
  polygon?: {
    txHash?: string | null;
    merkleRoot?: string | null;
    leafHash?: string | null;
    leafIndex?: number | null;
    proof?: string[] | null;
    batchId?: string | null;
    merkleValid?: boolean | null;
  };
};

export type MetaLiveIdentity = {
  id: string;
  status: MetaVerifyStatus;
  message: string;
  queriedAt: string | null;
  cached: boolean;
  fields: Record<string, string | null>;
  matchesEvidence?: boolean | null;
  belongsToWaba?: boolean | null;
  source?: "META_GRAPH_API" | "META_WABA_PHONE_NUMBERS" | null;
};

export type MetaCommunicationReport = {
  channel: "whatsapp" | "none";
  documentUnaffectedByLiveOutage: true;
  liveUnavailable: null | {
    status: "API_UNAVAILABLE";
    message: string;
  };
  live: {
    waba: MetaLiveIdentity | null;
    phone: MetaLiveIdentity | null;
    template: MetaLiveIdentity | null;
    lastLiveCheckAt: string | null;
    templateNameMatchesSnapshot: boolean | null;
    templateLangMatchesSnapshot: boolean | null;
    templateContentHistoricalNote: string;
  };
  message: {
    wamid: string | null;
    explanation: string;
    wamidSource: "graph_http_raw" | "parsed_graph_json" | "extracted_id_only" | "none";
    inSendResponse: boolean;
    sendResponseRawPreserved: boolean;
    sendHttpStatus: number | null;
    sendBodyHash: string | null;
  };
  inconsistencies: Array<{ code: string; message: string; status: MetaVerifyStatus }>;
  chronology: HistoricalMetaEvent[];
  identification: {
    notificationId: string;
    campaignId: string | null;
    wamid: string | null;
    wabaId: string | null;
    phoneNumberId: string | null;
    templateId: string | null;
    templateName: string | null;
    templateLang: string | null;
    /** Teléfono del destinatario conservado en la constancia. No es el Phone Number ID. */
    recipientPhone: string | null;
    /** recipient_id informado por Meta en webhooks históricos. */
    webhookRecipientId: string | null;
  };
  recipientEvidence: RecipientMetaEvidence;
  disclaimer: string;
};

export type RecipientMetaEvidence = {
  consignedPhone: string | null;
  webhookRecipientId: string | null;
  match: boolean | null;
  status: MetaVerifyStatus;
  matchMessage: string;
  delivered: boolean;
  read: boolean;
  rawPreserved: boolean;
  summary: string;
  sourceNote: string | null;
};
