import { notFound } from "@/lib/public-api/errors";

/** IDOR/BOLA: un recurso de otro tenant se oculta como 404. */
export function assertTenant(resourceOrgId: string, ctxOrgId: string): void {
  if (resourceOrgId !== ctxOrgId) {
    throw notFound("not_found", "Resource not found.");
  }
}
