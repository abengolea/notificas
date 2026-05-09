/** Límites de destinatarios por plan (espejo cliente de `org-server`). */
export function maxRecipientsForPlan(plan: string | undefined): number {
  switch (plan) {
    case 'business':
      return 2000;
    case 'enterprise':
      return 1_000_000;
    default:
      return 500;
  }
}
