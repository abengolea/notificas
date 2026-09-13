import type { ArtRecipient, ArtRecipientStatus } from "@/lib/art/types";

export type ContactChange = {
  field: "phone" | "email";
  previousValue: string;
  nextValue: string;
};

export function planContactChange(input: {
  recipient: Pick<ArtRecipient, "phone" | "email" | "status">;
  field: "phone" | "email";
  nextValue: string;
  revalidateOnPhoneChange: boolean;
  revalidateOnEmailChange: boolean;
}): {
  change: ContactChange;
  revalidationRequired: boolean;
  nextStatus: ArtRecipientStatus;
  identityPending: boolean;
} {
  const previousValue = input.field === "phone" ? input.recipient.phone : input.recipient.email;
  const change = { field: input.field, previousValue, nextValue: input.nextValue };
  const needsRevalidate =
    input.field === "phone" ? input.revalidateOnPhoneChange : input.revalidateOnEmailChange;

  if (input.recipient.status === "revoked" || input.recipient.status === "rejected") {
    return {
      change,
      revalidationRequired: needsRevalidate,
      nextStatus: input.recipient.status,
      identityPending: false,
    };
  }

  if (!needsRevalidate) {
    return {
      change,
      revalidationRequired: false,
      nextStatus: input.recipient.status,
      identityPending: false,
    };
  }

  return {
    change,
    revalidationRequired: true,
    nextStatus: "adhesion_pending",
    identityPending: true,
  };
}
