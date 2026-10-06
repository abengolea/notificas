export function normalizeAdminEmail(raw: string): string {
  return String(raw || "").trim().toLowerCase();
}

export type ChangeOrgAdminEmailPlan =
  | { action: "noop"; email: string }
  | { action: "rename"; adminUid: string; from: string; to: string }
  | {
      action: "reassign";
      fromUid: string;
      toUid: string;
      fromEmail: string;
      toEmail: string;
      createUser: boolean;
    }
  | { action: "conflict"; error: string };

export function planChangeOrgAdminEmail(input: {
  currentAdminUid: string;
  currentAdminEmail: string;
  nextEmail: string;
  existingUserByNextEmail: { uid: string } | null;
  nextEmailOwnsOtherOrg: boolean;
}): ChangeOrgAdminEmailPlan {
  const currentUid = String(input.currentAdminUid || "").trim();
  const from = normalizeAdminEmail(input.currentAdminEmail);
  const to = normalizeAdminEmail(input.nextEmail);

  if (!currentUid) {
    return { action: "conflict", error: "La organización no tiene administrador." };
  }
  if (!to || !to.includes("@")) {
    return { action: "conflict", error: "Ingresá un email válido." };
  }
  if (to === from) {
    return { action: "noop", email: to };
  }
  if (input.nextEmailOwnsOtherOrg) {
    return {
      action: "conflict",
      error: "Ese email ya es administrador de otra empresa.",
    };
  }

  const existing = input.existingUserByNextEmail;
  if (!existing) {
    return { action: "rename", adminUid: currentUid, from, to };
  }
  if (existing.uid === currentUid) {
    return { action: "noop", email: to };
  }
  return {
    action: "reassign",
    fromUid: currentUid,
    toUid: existing.uid,
    fromEmail: from,
    toEmail: to,
    createUser: false,
  };
}
