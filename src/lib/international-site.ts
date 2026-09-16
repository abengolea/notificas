import { LEGACY_ARCHIVO_BASE_PATH } from "@/lib/legacy-archivo";

/** Apex internacional. La plataforma argentina sigue en .com.ar. */
export const INTERNATIONAL_ORIGIN = "https://notificas.com";
export const ARGENTINA_ORIGIN = "https://notificas.com.ar";
export const INTL_PREVIEW_PATH = "/intl";
export const BRAZIL_PATH_PREFIX = "/br";
export const COLOMBIA_PATH_PREFIX = "/co";

export function isBrazilPublicPath(pathname: string): boolean {
  return pathname === BRAZIL_PATH_PREFIX || pathname.startsWith(`${BRAZIL_PATH_PREFIX}/`);
}

export function isColombiaPublicPath(pathname: string): boolean {
  return pathname === COLOMBIA_PATH_PREFIX || pathname.startsWith(`${COLOMBIA_PATH_PREFIX}/`);
}

export function localeForPublicPath(pathname: string): "pt-BR" | "es-CO" | "es-AR" {
  if (isBrazilPublicPath(pathname)) return "pt-BR";
  if (isColombiaPublicPath(pathname)) return "es-CO";
  return "es-AR";
}

export const INTERNATIONAL_TITLE =
  "Notificas | Comunicaciones digitales verificables";
export const INTERNATIONAL_DESCRIPTION =
  "Comunicaciones digitales verificables por WhatsApp y email. Argentina, Brasil y Colombia están online.";

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
  { id: "BR", name: "Brasil", status: "Acessar", href: "/br" },
  { id: "CO", name: "Colombia", status: "Ingresar", href: "/co" },
];

export type InternationalGate =
  | { type: "passthrough" }
  | { type: "rewrite"; pathname: string }
  | { type: "redirect"; location: string; status: 301 | 308 };

type HeaderReader = {
  get(name: string): string | null;
};

export function hostnameOf(hostHeader: string): string {
  let value = hostHeader.trim().toLowerCase();
  if (!value) return "";
  if (value.startsWith("http://") || value.startsWith("https://")) {
    try {
      return new URL(value).hostname.toLowerCase();
    } catch {
      value = value.replace(/^https?:\/\//, "");
    }
  }
  return (value.split("/")[0] ?? "").split(":")[0]?.trim() ?? "";
}

export function isKnownPublicHost(hostHeader: string): boolean {
  return (KNOWN_PUBLIC_HOSTS as readonly string[]).includes(hostnameOf(hostHeader));
}

function hostnamesFromListHeader(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((part) => hostnameOf(part))
    .filter(Boolean);
}

function hostnamesFromForwarded(value: string | null): string[] {
  if (!value) return [];
  const hosts: string[] = [];
  for (const element of value.split(",")) {
    const match = /(?:^|;)\s*host\s*=\s*"?([^;";]+)"?/i.exec(element);
    if (match?.[1]) hosts.push(hostnameOf(match[1]));
  }
  return hosts.filter(Boolean);
}

function knownPublicHostsFromRequest(headers: HeaderReader): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  const push = (value: string) => {
    if (!value || seen.has(value) || !isKnownPublicHost(value)) return;
    seen.add(value);
    ordered.push(value);
  };
  for (const item of hostnamesFromListHeader(headers.get("x-forwarded-host"))) push(item);
  for (const item of hostnamesFromListHeader(headers.get("x-original-host"))) push(item);
  for (const item of hostnamesFromForwarded(headers.get("forwarded"))) push(item);
  push(hostnameOf(headers.get("host") ?? ""));
  return ordered;
}

/**
 * Hostname público de la request.
 * En App Hosting el `Host` interno suele ser el *.hosted.app o el canónico
 * `.com.ar`; el dominio que pidió el usuario viene en `x-forwarded-host`.
 * Un forwarded host desconocido se ignora (anti-spoof).
 * Si aparece `www` en cualquier header conocido, gana: hace falta para 301 al apex.
 */
export function hostnameFromRequestHeaders(headers: HeaderReader): string {
  const known = knownPublicHostsFromRequest(headers);
  const www = known.find((item) => item.startsWith("www."));
  if (www) return www;
  if (known[0]) return known[0];
  return hostnameOf(headers.get("host") ?? "");
}

export function internationalLandingMetadata(indexable: boolean) {
  return {
    metadataBase: new URL(INTERNATIONAL_ORIGIN),
    title: { absolute: INTERNATIONAL_TITLE },
    description: INTERNATIONAL_DESCRIPTION,
    applicationName: "Notificas",
    alternates: {
      canonical: INTERNATIONAL_ORIGIN,
      languages: {
        es: INTERNATIONAL_ORIGIN,
        "pt-BR": `${INTERNATIONAL_ORIGIN}/br`,
        "es-CO": `${INTERNATIONAL_ORIGIN}/co`,
        "x-default": INTERNATIONAL_ORIGIN,
      },
    },
    openGraph: {
      type: "website" as const,
      locale: "es_LA",
      url: INTERNATIONAL_ORIGIN,
      siteName: "Notificas",
      title: INTERNATIONAL_TITLE,
      description: INTERNATIONAL_DESCRIPTION,
    },
    twitter: {
      card: "summary_large_image" as const,
      title: INTERNATIONAL_TITLE,
      description: INTERNATIONAL_DESCRIPTION,
    },
    robots: indexable
      ? { index: true, follow: true }
      : { index: false, follow: true },
  };
}

export function isInternationalHost(hostHeader: string): boolean {
  return (INTERNATIONAL_HOSTS as readonly string[]).includes(hostnameOf(hostHeader));
}

export function isArgentinaHost(hostHeader: string): boolean {
  return (ARGENTINA_HOSTS as readonly string[]).includes(hostnameOf(hostHeader));
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

function isIntlPreviewPath(pathname: string): boolean {
  return pathname === INTL_PREVIEW_PATH || pathname.startsWith(`${INTL_PREVIEW_PATH}/`);
}

/**
 * Qué hace notificas.com: landing internacional en `/`,
 * envíos viejos al archivo, el resto a .com.ar.
 *
 * Prioridad: landings BR/CO e `/intl` en .com.ar → .com; www → apex;
 * rutas del SPA viejo → archivo; `/` en .com → landing internacional.
 */
export function resolveInternationalGate(opts: {
  host: string;
  pathname: string;
  search?: string;
}): InternationalGate {
  const host = hostnameOf(opts.host);
  const search = opts.search ?? "";
  const pathname = opts.pathname || "/";

  if (isArgentinaHost(host)) {
    if (isBrazilPublicPath(pathname) || isColombiaPublicPath(pathname)) {
      return {
        type: "redirect",
        location: `${INTERNATIONAL_ORIGIN}${pathname}${search}`,
        status: 301,
      };
    }
    if (isIntlPreviewPath(pathname)) {
      return {
        type: "redirect",
        location: `${INTERNATIONAL_ORIGIN}/${search}`,
        status: 301,
      };
    }
    if (host === "www.notificas.com.ar") {
      return {
        type: "redirect",
        location: `${ARGENTINA_ORIGIN}${pathname}${search}`,
        status: 301,
      };
    }
    return { type: "passthrough" };
  }

  if (!isInternationalHost(host)) return { type: "passthrough" };

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

  if (isIntlPreviewPath(pathname)) {
    return {
      type: "redirect",
      location: `${INTERNATIONAL_ORIGIN}/${search}`,
      status: 301,
    };
  }

  if (pathname === "/") {
    return { type: "rewrite", pathname: INTL_PREVIEW_PATH };
  }

  if (isBrazilPublicPath(pathname) || isColombiaPublicPath(pathname)) {
    return { type: "passthrough" };
  }

  if (isInternalAsset(pathname)) return { type: "passthrough" };

  return {
    type: "redirect",
    location: `${ARGENTINA_ORIGIN}${pathname}${search}`,
    status: 308,
  };
}
