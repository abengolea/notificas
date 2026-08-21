export const META_VERIFY_STATUSES = [
  "VERIFIED",
  "HISTORICAL_VERIFIED",
  "HISTORICAL_PRESERVED",
  "NOT_AVAILABLE",
  "PENDING",
  "FAILED",
  "API_UNAVAILABLE",
] as const;

export type MetaVerifyStatus = (typeof META_VERIFY_STATUSES)[number];

export type EvidenceSource =
  | "meta_graph_live"
  | "meta_webhook_historical"
  | "meta_send_response"
  | "evidence_snapshot"
  | "polygon";

export function liveMetaFailureDoesNotInvalidateDocument(status: MetaVerifyStatus): boolean {
  return status === "API_UNAVAILABLE" || status === "NOT_AVAILABLE" || status === "PENDING";
}
