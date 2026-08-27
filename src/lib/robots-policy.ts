/**
 * Política de crawlers para páginas públicas.
 *
 * Separa bots de búsqueda/recuperación (permitidos en rutas públicas) de bots
 * habitualmente asociados a entrenamiento (no habilitados aquí).
 */

/** Prefijos que no deben rastrearse ni indexarse. */
export const PRIVATE_PATH_PREFIXES = [
  "/api/",
  "/admin/",
  "/dashboard/",
  "/empresa/",
  "/cuenta/",
  "/reader/",
  "/pdf-viewer/",
  "/process-payment/",
  "/email-preview/",
  "/test-firestore/",
  "/test-polygon/",
  "/test-reader/",
  "/linkRedirect",
] as const;

/** Rutas privadas/sensibles que nunca van al sitemap. */
export const PRIVATE_SITEMAP_PATHS = [
  "/login",
  "/dashboard",
  "/admin",
  "/empresa",
  "/cuenta",
  "/reader",
  "/pdf-viewer",
  "/process-payment",
  "/email-preview",
  "/api",
  "/linkRedirect",
] as const;

/** Bots de búsqueda / recuperación (ChatGPT, Claude). No son bots de entrenamiento. */
export const SEARCH_RETRIEVAL_USER_AGENTS = [
  "OAI-SearchBot",
  "Claude-SearchBot",
  "Claude-User",
] as const;

/**
 * Bots asociados potencialmente a entrenamiento.
 * Quedan bloqueados de forma explícita: no se asume consentimiento de training.
 */
export const TRAINING_USER_AGENTS = ["GPTBot", "ClaudeBot"] as const;
