import { createHash } from "crypto";
import type { ArtAuditEventType, ArtBlockchainStatus } from "@/lib/art/types";

export function canonicalAuditPayload(input: {
  eventId: string;
  timestamp: string;
  orgId: string;
  recipientId: string | null;
  type: ArtAuditEventType;
  actor: string;
  source: string;
  previousHash: string | null;
  metadata: Record<string, unknown>;
}): string {
  const meta = JSON.stringify(input.metadata, Object.keys(input.metadata).sort());
  return [
    "art-audit-v1",
    input.eventId,
    input.timestamp,
    input.orgId,
    input.recipientId || "",
    input.type,
    input.actor,
    input.source,
    input.previousHash || "GENESIS",
    meta,
  ].join("|");
}

export function hashAuditEvent(payload: string): string {
  return createHash("sha256").update(payload, "utf8").digest("hex");
}

export function shouldAnchorOnChain(type: ArtAuditEventType): boolean {
  return (
    type === "ADHESION_ACCEPTED" ||
    type === "ADHESION_REVOKED" ||
    type === "IDENTITY_VERIFIED" ||
    type === "CONTACT_CHANGED"
  );
}

export function resolveBlockchainStatus(input: {
  eventHash: string;
  polygonTxHash: string | null | undefined;
  chainConfigured: boolean;
  attempted: boolean;
  failed: boolean;
}): ArtBlockchainStatus {
  if (input.polygonTxHash) return "BLOCKCHAIN_ANCHORED";
  if (input.failed) return "BLOCKCHAIN_FAILED";
  if (input.attempted && input.chainConfigured) return "BLOCKCHAIN_PENDING";
  void input.eventHash;
  return "HASH_GENERATED";
}

export function blockchainStatusLabel(status: ArtBlockchainStatus, polygonTxHash?: string | null): string {
  switch (status) {
    case "BLOCKCHAIN_ANCHORED":
      return `Anclado en blockchain · tx ${polygonTxHash || ""}`.trim();
    case "BLOCKCHAIN_PENDING":
      return "Anclaje blockchain pendiente. El hash de evidencia ya está generado.";
    case "BLOCKCHAIN_FAILED":
      return "Anclaje blockchain fallido. El hash de evidencia está generado.";
    default:
      return "Hash generado. No registrado en blockchain.";
  }
}
