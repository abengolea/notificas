import { artModuleEnabled } from "@/lib/art/enabled";
import { evaluateEligibility } from "@/lib/art/eligibility";
import { findRecipientForSrt, getOrCreateArtConfig } from "@/lib/art/store";
import { appendArtAuditEvent, emitArtWebhook } from "@/lib/art/audit";
import type { ArtEligibility } from "@/lib/art/types";
import { parseNotificationType } from "@/lib/art/notification-type";
import { artModuleAvailableForOrg } from "@/lib/art/pilot";

export { parseNotificationType } from "@/lib/art/notification-type";

export async function checkSrtArtEligibility(input: {
  orgId: string;
  notificationType?: unknown;
  recipientId?: string;
  cuil?: string;
  dni?: string;
  phone?: string;
  email?: string;
}): Promise<ArtEligibility | null> {
  if (parseNotificationType(input.notificationType) !== "SRT_ART") return null;
  if (!artModuleEnabled()) {
    return {
      eligibleForElectronicNotification: false,
      reason: "MODULE_DISABLED",
      conventionalChannelRequired: true,
      status: null,
      recipientId: null,
    };
  }
  if (!artModuleAvailableForOrg(input.orgId)) {
    return {
      eligibleForElectronicNotification: false,
      reason: "ART_MODULE_NOT_AVAILABLE",
      conventionalChannelRequired: true,
      status: null,
      recipientId: null,
    };
  }
  const config = await getOrCreateArtConfig(input.orgId);
  const recipient = await findRecipientForSrt(input.orgId, {
    recipientId: input.recipientId,
    cuil: input.cuil,
    dni: input.dni,
    phone: input.phone,
    email: input.email,
  });
  const result = evaluateEligibility({ moduleEnabled: true, recipient, config });
  if (!result.eligibleForElectronicNotification && recipient) {
    await appendArtAuditEvent({
      orgId: input.orgId,
      recipientId: recipient.id,
      type: "CONVENTIONAL_CHANNEL_REQUIRED",
      actor: "system",
      source: "srt_gate",
      metadata: { reason: result.reason },
    }).catch(() => undefined);
    await emitArtWebhook({
      orgId: input.orgId,
      type: "art.recipient.requires_conventional_channel",
      data: { recipient_id: recipient.id, reason: result.reason },
    }).catch(() => undefined);
  }
  return result;
}
