import type { ArtRecipientStatus } from "@/lib/art/types";

export const ART_RECIPIENT_STATUS_LABELS: Record<ArtRecipientStatus, string> = {
  pending: "Pendiente",
  identity_pending: "Pendiente de identidad",
  identity_verified: "Identidad verificada",
  adhesion_pending: "Pendiente de adhesión",
  active: "Activo",
  rejected: "Rechazado",
  revoked: "Revocado",
  suspended: "Suspendido",
  requires_conventional_channel: "Requiere canal convencional",
};

export const ART_IDENTITY_STATUS_LABELS = {
  none: "Sin verificar",
  pending: "Pendiente",
  verified: "Identidad verificada",
  failed: "No verificada",
} as const;

export type ArtIdentityStatusKey = keyof typeof ART_IDENTITY_STATUS_LABELS;

export type ArtStatusTone = "positive" | "neutral" | "caution" | "danger";

const PENDING_RECIPIENT_STATUSES = new Set<string>([
  "pending",
  "identity_pending",
  "identity_verified",
  "adhesion_pending",
]);

export function artRecipientStatusLabel(status: string | null | undefined): string {
  if (!status) return "—";
  return ART_RECIPIENT_STATUS_LABELS[status as ArtRecipientStatus] ?? "—";
}

export function artIdentityStatusLabel(status: string | null | undefined): string {
  if (!status) return ART_IDENTITY_STATUS_LABELS.none;
  return ART_IDENTITY_STATUS_LABELS[status as ArtIdentityStatusKey] ?? "—";
}

export function artRecipientStatusTone(status: string | null | undefined): ArtStatusTone {
  switch (status) {
    case "active":
    case "identity_verified":
      return "positive";
    case "requires_conventional_channel":
      return "caution";
    case "revoked":
    case "rejected":
    case "suspended":
      return "danger";
    default:
      return "neutral";
  }
}

export function isPendingRecipientStatus(status: string | null | undefined): boolean {
  return PENDING_RECIPIENT_STATUSES.has(String(status || ""));
}

export function recipientMatchesStatusFilter(status: string, filter: string): boolean {
  if (filter === "all") return true;
  if (filter === "pending_group") {
    return status === "pending" || status === "identity_pending" || status === "adhesion_pending";
  }
  if (filter === "not_adhered") {
    return status === "pending" || status === "identity_pending" || status === "adhesion_pending" || status === "rejected";
  }
  return status === filter;
}
