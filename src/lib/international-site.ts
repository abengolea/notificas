import { LEGACY_ARCHIVO_BASE_PATH } from "@/lib/legacy-archivo";

/** Apex internacional. La plataforma argentina sigue en .com.ar. */
export const INTERNATIONAL_ORIGIN = "https://notificas.com";
export const ARGENTINA_ORIGIN = "https://notificas.com.ar";
export const INTL_PREVIEW_PATH = "/intl";

export const INTERNATIONAL_TITLE =
  "Notificas | Comunicaciones digitales verificables";
export const INTERNATIONAL_DESCRIPTION =
  "Comunicaciones digitales verificables por WhatsApp y email. Argentina está online. Brasil y Colombia, pronto.";

export const INTERNATIONAL_HOSTS = ["notificas.com", "www.notificas.com"] as const;
export const ARGENTINA_HOSTS = ["notificas.com.ar", "www.notificas.com.ar"] as const;

const KNOWN_PUBLIC_HOSTS = [
  ...INTERNATIONAL_HOSTS,
  ...ARGENTINA_HOSTS,
] as const;

/** Prefijos del SPA Ionic que, en .com, van al archivo de .com.ar. */
export const LEGACY_COM_PATH_PREFIXES = [
  "/login",
  "/folder",
  "/reader",
  "/history",
  "/download-file",
  "/doc-archive-list",
  "/text-editor",
  "/text-editor-list",
  "/contacts",
  "/profile",
  "/current-account",
  "/templates",
  "/transactions-types",
  "/users",
  "/recover",
  LEGACY_ARCHIVO_BASE_PATH,
] as const;

export type InternationalCountryId = "AR" | "BR" | "CO";

export const INTERNATIONAL_COUNTRIES: ReadonlyArray<{
  id: InternationalCountryId;
  name: string;
  status: string;
  href: string | null;
}> = [
  { id: "AR", name: "Argentina", status: "Entrar", href: `${ARGENTINA_ORIGIN}/` },
  { id: "BR", name: "Brasil", status: "Em breve", href: null },
  { id: "CO", name: "Colombia", status: "Próximamente", href: null },
];

export type InternationalGate =
  | { type: "passthrough" }
  | { type: "rewrite"; pathname: string }
  | { type: "redirect"; location: string; status: 301 | 308 };

type HeaderReader = {
  get(name: string): string | null;
};

export function hostnameOf(hostHeader: string): string {
  return hostHeader.split(":")[0]?.toLowerCase().trim() ?? "";
}

export function isKnownPublicHost(hostHeader: string): boolean {
  return (KNOWN_PUBLIC_HOSTS as readonly string[]).includes(hostnameOf(hostHeader));
}

/**
 * Hostname público de la request.
 * Si `Host` ya es un dominio nuestro, se ignora `x-forwarded-host` (anti-spoof).
 * Si `Host` es el default de App Hosting / Cloud Run, se usa el forwarded host conocido.
 */
export function hostnameFromRequestHeaders(headers: HeaderReader): string {
  const host = hostnameOf(headers.get("host") ?? "");
  const forwarded = hostnameOf(
    (headers.get("x-forwarded-host") ?? "").split(",")[0] ?? ""
  );

  if (isKnownPublicHost(host)) return host;
  if (isKnownPublicHost(forwarded)) return forwarded;
  return host;
}

export function isInternationalHost(hostHeader: string): boolean {
  return (INTERNATIONAL_HOSTS as readonly string[]).includes(hostnameOf(hostHeader));
}

export function publicOriginFromHost(hostHeader: string): string {
  return isInternationalHost(hostHeader) ? INTERNATIONAL_ORIGIN : ARGENTINA_ORIGIN;
}

export function isLegacyComPath(pathname: string): boolean {
  return LEGACY_COM_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

function isInternalAsset(pathname: string): boolean {
  if (pathname.startsWith("/_next")) return true;
  if (pathname.startsWith("/favicon")) return true;
  if (pathname.startsWith("/icon")) return true;
  if (pathname.startsWith("/apple-icon")) return true;
  if (pathname.includes("opengraph-image")) return true;
  if (pathname.includes("twitter-image")) return true;
  return /\.[a-z0-9]+$/i.test(pathname);
}

/**
 * Qué hace notificas.com: landing internacional en `/`,
 * envíos viejos al archivo, el resto a .com.ar.
 *
 * Prioridad: www → apex; rutas del SPA viejo → archivo; `/` → landing internacional.
 */
export function resolveInternationalGate(opts: {
  host: string;
  pathname: string;
  search?: string;
}): InternationalGate {
  if (!isInternationalHost(opts.host)) return { type: "passthrough" };

  const host = hostnameOf(opts.host);
  const search = opts.search ?? "";
  const pathname = opts.pathname || "/";

  if (host === "www.notificas.com") {
    return {
      type: "redirect",
      location: `${INTERNATIONAL_ORIGIN}${pathname}${search}`,
      status: 301,
    };
  }

  if (isLegacyComPath(pathname)) {
    const archivoPath = pathname.startsWith(LEGACY_ARCHIVO_BASE_PATH)
      ? pathname
      : `${LEGACY_ARCHIVO_BASE_PATH}${pathname}`;
    return {
      type: "redirect",
      location: `${ARGENTINA_ORIGIN}${archivoPath}${search}`,
      status: 308,
    };
  }

  if (pathname === "/" || pathname === INTL_PREVIEW_PATH) {
    return { type: "rewrite", pathname: INTL_PREVIEW_PATH };
  }

  if (isInternalAsset(pathname)) return { type: "passthrough" };

  return {
    type: "redirect",
    location: `${ARGENTINA_ORIGIN}${pathname}${search}`,
    status: 308,
  };
}
