import {
  ART_MODULE_NOT_AVAILABLE,
  PILOT_RECIPIENT_NOT_ALLOWED,
  NOTIFICATION_TYPE_REQUIRED,
  artModuleAvailableForOrg,
  artPilotControlsApply,
  assertExplicitNotificationType,
  assertPilotCampaignLimit,
  assertPilotRecipientAllowed,
} from "@/lib/art/pilot";
import { isExplicitNotificationType, parseNotificationType } from "@/lib/art/notification-type";
import type { SrtNotificationType } from "@/lib/art/types";

export function assertArtOutboundClassification(
  orgId: string | null | undefined,
  notificationType: unknown
):
  | { ok: true; value: SrtNotificationType | null }
  | { ok: false; code: typeof NOTIFICATION_TYPE_REQUIRED; httpStatus: 400 } {
  if (!artModuleAvailableForOrg(orgId)) {
    return { ok: true, value: null };
  }
  if (artPilotControlsApply(orgId)) {
    return assertExplicitNotificationType(notificationType, { required: true });
  }
  if (!isExplicitNotificationType(notificationType)) {
    return { ok: true, value: "ORDINARY" };
  }
  return { ok: true, value: parseNotificationType(notificationType) };
}

export function assertArtPilotOutboundRecipient(input: {
  orgId?: string | null;
  email?: string | null;
  phone?: string | null;
}): { ok: true } | { ok: false; code: typeof PILOT_RECIPIENT_NOT_ALLOWED; httpStatus: 403 } {
  return assertPilotRecipientAllowed(input);
}

export function assertArtPilotCampaignSize(
  orgId: string | null | undefined,
  count: number
): { ok: true } | { ok: false; code: string; httpStatus: 400 } {
  return assertPilotCampaignLimit(count, orgId);
}

export function artOrgBlockedMessage(orgId: string | null | undefined): typeof ART_MODULE_NOT_AVAILABLE | null {
  if (artModuleAvailableForOrg(orgId)) return null;
  return ART_MODULE_NOT_AVAILABLE;
}

export function artPilotOutboundApplies(orgId: string | null | undefined): boolean {
  return artPilotControlsApply(orgId);
}
