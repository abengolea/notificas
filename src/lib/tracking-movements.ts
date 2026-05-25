/**
 * Movimientos de tracking visibles para el destinatario / certificación.
 * Excluye aperturas de detalle hechas solo por el remitente (no cuentan como lectura del destinatario).
 */
type MovementFilterOptions = {
  recipientEmail?: string | null;
};

function normalizeEmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function filterRecipientVisibleMovements<
  T extends {
    type?: string;
    viewerIsSender?: boolean;
    recipientEmail?: string;
    mailRecipientEmail?: string;
  },
>(
  movements: T[] | undefined | null,
  options: MovementFilterOptions = {},
): T[] {
  const expectedRecipient = normalizeEmail(options.recipientEmail);

  return (movements || []).filter((m) => {
    if ((m.type === "app_opened" || m.type === "attachment_opened") && m.viewerIsSender) {
      return false;
    }

    if (m.type === "attachment_opened" && expectedRecipient) {
      const movementRecipient = normalizeEmail(m.recipientEmail);

      if (
        movementRecipient &&
        movementRecipient !== "unknown" &&
        movementRecipient !== expectedRecipient
      ) {
        return false;
      }
    }

    return true;
  });
}

export function countRecipientOpenMovements<
  T extends {
    type?: string;
    viewerIsSender?: boolean;
    recipientEmail?: string;
    mailRecipientEmail?: string;
  },
>(
  movements: T[] | undefined | null,
  options: MovementFilterOptions = {},
): number {
  return filterRecipientVisibleMovements(movements, options).filter(
    (m) =>
      m.type === "email_opened" ||
      m.type === "app_opened" ||
      m.type === "reader_magic_open",
  ).length;
}
