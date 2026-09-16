/**
 * Archivo histórico de notificas.com, montado de forma aislada en
 * https://notificas.com.ar/archivo
 *
 * El SPA Ionic/Angular sigue hablando con la API legacy
 * (https://notificas-api-backup.onrender.com). No se reescriben APIs,
 * Firebase, WhatsApp, Resend, Meta, blockchain ni webhooks de la
 * plataforma actual.
 */

export const LEGACY_ARCHIVO_BASE_PATH = "/archivo";
export const LEGACY_ARCHIVO_LOGIN_HREF = `${LEGACY_ARCHIVO_BASE_PATH}/login`;
export const LEGACY_ARCHIVO_PUBLIC_LABEL = "Archivo de envíos anteriores";
export const LEGACY_ARCHIVO_PUBLIC_HEADING = "¿Usabas notificas.com?";
export const LEGACY_ARCHIVO_PUBLIC_BLURB =
  "Los envíos hechos en la plataforma anterior se consultan en el archivo histórico. Los envíos nuevos se hacen en esta web.";

/** Rutas reales del SPA Ionic (app-routing.module.ts), relativas al archivo. */
export const LEGACY_ARCHIVO_SPA_ROUTES = [
  "/",
  "/folder/Inbox",
  "/folder/Outbox",
  "/login",
  "/reader/:uuid",
  "/history",
  "/download-file/:key",
  "/doc-archive-list",
  "/text-editor",
  "/text-editor-list",
  "/contacts",
  "/contacts/new",
  "/contacts/edit/:id",
  "/profile",
  "/current-account",
  "/templates",
  "/templates/new",
  "/templates/edit/:id",
  "/transactions-types",
  "/transactions-types/edit/:id",
  "/users/lists",
  "/users/new",
  "/recover/:recoverpassword",
] as const;

export const LEGACY_ARCHIVO_ORIGIN_HOST = "notificas.com";
export const LEGACY_ARCHIVO_API_ORIGIN = "https://notificas-api-backup.onrender.com";

/** Rewrites Next: SPA fallback. Los estáticos de public/archivo se resuelven antes. */
export function legacyArchivoRewrites() {
  return {
    afterFiles: [
      {
        source: `${LEGACY_ARCHIVO_BASE_PATH}`,
        destination: `${LEGACY_ARCHIVO_BASE_PATH}/index.html`,
      },
    ],
    fallback: [
      {
        source: `${LEGACY_ARCHIVO_BASE_PATH}/:path*`,
        destination: `${LEGACY_ARCHIVO_BASE_PATH}/index.html`,
      },
    ],
  };
}

export function legacyArchivoHeaders() {
  const seoHeaders = [
    { key: "Cache-Control", value: "no-cache" },
    { key: "X-Robots-Tag", value: "noindex, follow" },
  ];
  return [
    {
      source: `${LEGACY_ARCHIVO_BASE_PATH}`,
      headers: seoHeaders,
    },
    {
      source: `${LEGACY_ARCHIVO_BASE_PATH}/index.html`,
      headers: seoHeaders,
    },
    {
      source: `${LEGACY_ARCHIVO_BASE_PATH}/:path*`,
      headers: [{ key: "X-Robots-Tag", value: "noindex, follow" }],
    },
  ];
}
