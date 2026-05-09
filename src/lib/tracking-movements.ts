/**
 * Movimientos de tracking visibles para el destinatario / certificación.
 * Excluye aperturas de detalle hechas solo por el remitente (no cuentan como lectura del destinatario).
 */
export function filterRecipientVisibleMovements<T extends { type?: string; viewerIsSender?: boolean }>(
  movements: T[] | undefined | null,
): T[] {
  return (movements || []).filter((m) => !(m.type === "app_opened" && m.viewerIsSender));
}

export function countRecipientOpenMovements<T extends { type?: string; viewerIsSender?: boolean }>(
  movements: T[] | undefined | null,
): number {
  return filterRecipientVisibleMovements(movements).filter(
    (m) => m.type === "email_opened" || m.type === "app_opened",
  ).length;
}
