import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

import sitemap from "../app/sitemap";
import {
  LEGACY_ARCHIVO_API_ORIGIN,
  LEGACY_ARCHIVO_BASE_PATH,
  LEGACY_ARCHIVO_LOGIN_HREF,
  LEGACY_ARCHIVO_SPA_ROUTES,
  legacyArchivoRewrites,
} from "./legacy-archivo";
import { PRIVATE_PATH_PREFIXES, PRIVATE_SITEMAP_PATHS } from "./robots-policy";

const here = path.dirname(fileURLToPath(import.meta.url));
const archivoIndex = path.join(here, "../../public/archivo/index.html");

test("el archivo legado queda aislado bajo /archivo y no entra al sitemap", () => {
  assert.equal(LEGACY_ARCHIVO_BASE_PATH, "/archivo");
  assert.ok(LEGACY_ARCHIVO_SPA_ROUTES.includes("/login"));
  assert.ok(LEGACY_ARCHIVO_SPA_ROUTES.includes("/reader/:uuid"));
  assert.ok(LEGACY_ARCHIVO_API_ORIGIN.includes("notificas-api-backup"));

  const urls = sitemap().map((entry) => entry.url);
  assert.equal(
    urls.some((url) => url.includes("/archivo")),
    false,
    "el sitemap de la web principal no debe listar /archivo"
  );
  assert.equal(
    PRIVATE_SITEMAP_PATHS.includes("/archivo" as never),
    false,
    "no se alteró la lista de rutas privadas del sitemap"
  );
  assert.equal(
    (PRIVATE_PATH_PREFIXES as readonly string[]).includes("/archivo"),
    false,
    "robots.txt de la web principal no se modifica para este montaje"
  );
});

test("Next reescribe solo las rutas SPA de /archivo después de los estáticos", () => {
  const rewrites = legacyArchivoRewrites();
  assert.equal(rewrites.afterFiles[0]?.source, "/archivo");
  assert.equal(rewrites.afterFiles[0]?.destination, "/archivo/index.html");
  assert.equal(rewrites.fallback[0]?.source, "/archivo/:path*");
  assert.equal(rewrites.fallback[0]?.destination, "/archivo/index.html");
});

test("el SPA copiado usa base href /archivo y no apunta assets a la raíz", () => {
  assert.equal(fs.existsSync(archivoIndex), true, "falta public/archivo/index.html");
  const html = fs.readFileSync(archivoIndex, "utf8");
  assert.match(html, /<base href="\/archivo\/">/);
  assert.doesNotMatch(html, /<base href="\/">/);
  assert.doesNotMatch(html, /href="\.\.\/assets\//);
  assert.match(html, /src="runtime\.[0-9a-f]+\.js"/);
});

test("el aviso del archivo explica consulta histórica y no bloquea el acceso", () => {
  const html = fs.readFileSync(archivoIndex, "utf8");
  const mainMatch = html.match(/src="(main\.[0-9a-f]+\.js[^"]*)"/);
  assert.ok(mainMatch, "falta el bundle main del SPA");
  const mainFile = path.join(path.dirname(archivoIndex), mainMatch[1].split("?")[0]);
  const bundle = fs.readFileSync(mainFile, "utf8");
  assert.doesNotMatch(bundle, /Acceso no disponible/);
  assert.match(bundle, /Archivo de consulta/);
  assert.match(bundle, /env\\xedos nuevos se hacen desde notificas\.com\.ar/);
  assert.match(bundle, /Consultar archivo/);
});

test("la web pública apunta al archivo histórico sin indexarlo", () => {
  assert.equal(LEGACY_ARCHIVO_LOGIN_HREF, "/archivo/login");
  const readSrc = (rel: string) => fs.readFileSync(path.join(here, "..", rel), "utf8");
  assert.match(readSrc("app/page.tsx"), /FaqSection/);
  for (const rel of [
    "app/login/page.tsx",
    "app/signup/page.tsx",
    "app/cuenta/activar-migracion/page.tsx",
    "components/public-footer.tsx",
    "components/faq-section.tsx",
    "components/legacy-archive-callout.tsx",
  ]) {
    assert.match(readSrc(rel), /LEGACY_ARCHIVO_/);
  }
});
