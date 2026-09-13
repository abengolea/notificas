import type { SrtNotificationType } from "@/lib/art/types";

export function parseNotificationType(raw: unknown): SrtNotificationType {
  const v = String(raw || "").trim().toUpperCase();
  return v === "SRT_ART" ? "SRT_ART" : "ORDINARY";
}

export function isExplicitNotificationType(raw: unknown): raw is SrtNotificationType {
  const v = String(raw || "").trim().toUpperCase();
  return v === "SRT_ART" || v === "ORDINARY";
}
