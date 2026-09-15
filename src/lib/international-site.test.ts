import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

import { buildSitemap } from "../app/sitemap";
import {
  ARGENTINA_ORIGIN,
  INTL_PREVIEW_PATH,
  INTERNATIONAL_COUNTRIES,
  INTERNATIONAL_ORIGIN,
  hostnameFromRequestHeaders,
  isInternationalHost,
  isLegacyComPath,
  localeForPublicPath,
  publicOriginFromHost,
  resolveInternationalGate,
} from "./international-site";
import { PRIVATE_PATH_PREFIXES, PRIVATE_SITEMAP_PATHS } from "./robots-policy";

const here = path.dirname(fileURLToPath(import.meta.url));

function headersOf(init: Record<string, string>) {
  const normalized = Object.fromEntries(
    Object.entries(init).map(([key, value]) => [key.toLowerCase(), value])
  );
  return {
    get(name: string) {
      return normalized[name.toLowerCase()] ?? null;
    },
  };
}

test("notificas.com.ar no se reescribe a la landing internacional", () => {
  assert.equal(isInternationalHost("notificas.com.ar"), false);
  assert.equal(isInternationalHost("localhost:9006"), false);
  assert.deepEqual(resolveInternationalGate({ host: "notificas.com.ar", pathname: "/" }), {
    type: "passthrough",
  });
  assert.deepEqual(
    resolveInternationalGate({ host: "localhost:9006", pathname: INTL_PREVIEW_PATH }),
    { type: "passthrough" }
  );
});

test("App Hosting: el dominio pedido va en x-forwarded-host", () => {
  assert.equal(
    hostnameFromRequestHeaders(
      headersOf({
        host: "notificas--notificas-f9953.us-central1.hosted.app",
        "x-forwarded-host": "notificas.com",
      })
    ),
    "notificas.com"
  );
  assert.equal(
    hostnameFromRequestHeaders(
      headersOf({
        host: "notificas.com.ar",
        "x-forwarded-host": "notificas.com",
      })
    ),
    "notificas.com"
  );
  assert.equal(
    hostnameFromRequestHeaders(
      headersOf({
        host: "notificas.com.ar",
        "x-forwarded-host": "https://notificas.com",
      })
    ),
    "notificas.com"
  );
  assert.equal(
    hostnameFromRequestHeaders(
      headersOf({
        host: "notificas--notificas-f9953.us-central1.hosted.app",
        forwarded: "for=1.2.3.4;host=notificas.com;proto=https",
      })
    ),
    "notificas.com"
  );
  assert.equal(
    hostnameFromRequestHeaders(
      headersOf({
        host: "notificas.com.ar",
        "x-forwarded-host": "evil.example",
      })
    ),
    "notificas.com.ar"
  );
  assert.equal(
    hostnameFromRequestHeaders(headersOf({ host: "localhost:9006" })),
    "localhost"
  );
  assert.equal(publicOriginFromHost("notificas.com"), INTERNATIONAL_ORIGIN);
  assert.equal(publicOriginFromHost("www.notificas.com.ar"), ARGENTINA_ORIGIN);
});

test("notificas.com sirve la landing en / y manda el SPA viejo al archivo", () => {
  assert.equal(isInternationalHost("notificas.com"), true);
  assert.equal(isInternationalHost("www.notificas.com:443"), true);
  assert.deepEqual(resolveInternationalGate({ host: "notificas.com", pathname: "/" }), {
    type: "rewrite",
    pathname: INTL_PREVIEW_PATH,
  });
  assert.deepEqual(
    resolveInternationalGate({ host: "www.notificas.com", pathname: "/", search: "?x=1" }),
    { type: "redirect", location: `${INTERNATIONAL_ORIGIN}/?x=1`, status: 301 }
  );
  assert.deepEqual(resolveInternationalGate({ host: "notificas.com", pathname: "/login" }), {
    type: "redirect",
    location: `${ARGENTINA_ORIGIN}/archivo/login`,
    status: 308,
  });
  assert.deepEqual(
    resolveInternationalGate({ host: "notificas.com", pathname: "/folder/Inbox" }),
    {
      type: "redirect",
      location: `${ARGENTINA_ORIGIN}/archivo/folder/Inbox`,
      status: 308,
    }
  );
  assert.deepEqual(resolveInternationalGate({ host: "notificas.com", pathname: "/signup" }), {
    type: "redirect",
    location: `${ARGENTINA_ORIGIN}/signup`,
    status: 308,
  });
  assert.deepEqual(
    resolveInternationalGate({ host: "notificas.com", pathname: "/_next/static/chunk.js" }),
    { type: "passthrough" }
  );
  assert.deepEqual(resolveInternationalGate({ host: "notificas.com", pathname: "/br" }), {
    type: "passthrough",
  });
  assert.deepEqual(
    resolveInternationalGate({ host: "notificas.com", pathname: "/br/verificar" }),
    { type: "passthrough" }
  );
  assert.deepEqual(
    resolveInternationalGate({ host: "notificas.com", pathname: "/br/termos" }),
    { type: "passthrough" }
  );
  assert.deepEqual(resolveInternationalGate({ host: "notificas.com", pathname: "/co" }), {
    type: "passthrough",
  });
  assert.deepEqual(
    resolveInternationalGate({ host: "notificas.com", pathname: "/co/privacidad" }),
    { type: "passthrough" }
  );
  assert.equal(isLegacyComPath("/login"), true);
  assert.equal(
    INTERNATIONAL_COUNTRIES.find((country) => country.id === "BR")?.href,
    "/br"
  );
  assert.equal(
    INTERNATIONAL_COUNTRIES.find((country) => country.id === "CO")?.href,
    "/co"
  );
});

test("la preview /intl no entra al sitemap ni a robots públicos", () => {
  assert.ok((PRIVATE_PATH_PREFIXES as readonly string[]).includes("/intl"));
  assert.ok((PRIVATE_SITEMAP_PATHS as readonly string[]).includes("/intl"));
  const argentinaUrls = buildSitemap(ARGENTINA_ORIGIN).map((entry) => entry.url);
  assert.equal(
    argentinaUrls.some((url) => url.includes("/intl")),
    false,
    "el sitemap de .com.ar no debe listar /intl"
  );
  const internationalUrls = buildSitemap(INTERNATIONAL_ORIGIN).map((entry) => entry.url);
  assert.deepEqual(internationalUrls, [
    INTERNATIONAL_ORIGIN,
    `${INTERNATIONAL_ORIGIN}/br`,
    `${INTERNATIONAL_ORIGIN}/br/pre-negativacao`,
    `${INTERNATIONAL_ORIGIN}/br/verificar`,
    `${INTERNATIONAL_ORIGIN}/br/termos`,
    `${INTERNATIONAL_ORIGIN}/co`,
    `${INTERNATIONAL_ORIGIN}/co/privacidad`,
    `${INTERNATIONAL_ORIGIN}/co/cookies`,
    `${INTERNATIONAL_ORIGIN}/co/terminos`,
    `${INTERNATIONAL_ORIGIN}/co/marco-normativo`,
  ]);
});

test("el locale público distingue Brasil, Colombia y Argentina", () => {
  assert.equal(localeForPublicPath("/br"), "pt-BR");
  assert.equal(localeForPublicPath("/br/verificar"), "pt-BR");
  assert.equal(localeForPublicPath("/br/termos"), "pt-BR");
  assert.equal(localeForPublicPath("/co"), "es-CO");
  assert.equal(localeForPublicPath("/co/privacidad"), "es-CO");
  assert.equal(localeForPublicPath("/"), "es-AR");
});

test("las banderas oficiales del gate internacional existen", () => {
  const flags = path.join(here, "../../public/intl/flags");
  assert.equal(fs.existsSync(path.join(flags, "argentina.svg")), true);
  assert.equal(fs.existsSync(path.join(flags, "brazil.svg")), true);
  assert.equal(fs.existsSync(path.join(flags, "colombia.svg")), true);
  assert.equal(fs.existsSync(path.join(here, "../../public/intl/paper.png")), true);
  const argentina = fs.readFileSync(path.join(flags, "argentina.svg"), "utf8");
  assert.match(argentina, /f6b40e/i);
  const brazil = fs.readFileSync(path.join(flags, "brazil.svg"), "utf8");
  assert.match(brazil, /#ffcb00|#009440/i);
});
