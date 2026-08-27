import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

import robots from "../app/robots";
import sitemap from "../app/sitemap";
import { GET as llmsTxtGet } from "../app/llms.txt/route";
import { matchAiReferrerHost, utmParamsFromSearch } from "./ai-referrers";
import {
  GEO_LANDING_PAGES,
  LEGAL_PUBLIC_PAGES,
  RESOURCE_HUB,
  SEO_GUIDE_PAGES,
} from "./public-resources";
import {
  PRIVATE_PATH_PREFIXES,
  PRIVATE_SITEMAP_PATHS,
  SEARCH_RETRIEVAL_USER_AGENTS,
  TRAINING_USER_AGENTS,
} from "./robots-policy";
import { createPageMetadata, NO_INDEX_METADATA, SITE_URL } from "./seo";
import {
  articleJsonLd,
  breadcrumbJsonLd,
  faqPageJsonLd,
  organizationJsonLd,
  softwareApplicationJsonLd,
  websiteJsonLd,
} from "./structured-data";

const here = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(here, "../app");

const NEW_PUBLIC_PATHS = GEO_LANDING_PAGES.map((page) => page.path);
const INDEXABLE_PATHS = [
  "/",
  "/verify",
  "/signup",
  RESOURCE_HUB.path,
  ...NEW_PUBLIC_PATHS,
  ...SEO_GUIDE_PAGES.map((page) => page.path),
  ...LEGAL_PUBLIC_PAGES.map((page) => page.path),
];

test("robots.txt incluye Allow para crawlers de búsqueda de ChatGPT y Claude", () => {
  const policy = robots();
  const rules = Array.isArray(policy.rules) ? policy.rules : [policy.rules];
  for (const agent of SEARCH_RETRIEVAL_USER_AGENTS) {
    const rule = rules.find((item) => item.userAgent === agent);
    assert.ok(rule, `falta regla para ${agent}`);
    assert.equal(rule?.allow, "/");
    const disallow = rule?.disallow;
    const list = Array.isArray(disallow) ? disallow : [disallow];
    for (const prefix of PRIVATE_PATH_PREFIXES) {
      assert.ok(list.includes(prefix), `${agent} debe seguir bloqueando ${prefix}`);
    }
  }
});

test("robots.txt no habilita entrenamiento: GPTBot y ClaudeBot quedan en Disallow", () => {
  const policy = robots();
  const rules = Array.isArray(policy.rules) ? policy.rules : [policy.rules];
  for (const agent of TRAINING_USER_AGENTS) {
    const rule = rules.find((item) => item.userAgent === agent);
    assert.ok(rule, `falta regla para ${agent}`);
    assert.equal(rule?.disallow, "/");
  }
});

test("robots.txt conserva bloqueo de rutas privadas para *", () => {
  const policy = robots();
  const rules = Array.isArray(policy.rules) ? policy.rules : [policy.rules];
  const star = rules.find((item) => item.userAgent === "*");
  assert.ok(star);
  const disallow = star?.disallow;
  const list = Array.isArray(disallow) ? disallow : [disallow];
  for (const prefix of PRIVATE_PATH_PREFIXES) {
    assert.ok(list.includes(prefix));
  }
  assert.equal(policy.sitemap, `${SITE_URL}/sitemap.xml`);
});

test("sitemap incluye las nuevas URLs públicas y omite rutas privadas", () => {
  const entries = sitemap();
  const urls = entries.map((entry) => entry.url);
  for (const publicPath of INDEXABLE_PATHS) {
    const expected = publicPath === "/" ? SITE_URL : `${SITE_URL}${publicPath}`;
    assert.ok(urls.includes(expected), `sitemap sin ${expected}`);
  }
  for (const privatePath of PRIVATE_SITEMAP_PATHS) {
    assert.equal(
      urls.some((url) => url === `${SITE_URL}${privatePath}` || url.includes(`${privatePath}/`)),
      false,
      `sitemap no debe incluir ${privatePath}`
    );
  }
});

test("metadata pública tiene canonical, title, description y no usa noindex", () => {
  for (const page of GEO_LANDING_PAGES) {
    const meta = createPageMetadata({
      title: page.title,
      description: page.description,
      path: page.path,
      ogType: "article",
    });
    assert.equal(meta.alternates?.canonical, `${SITE_URL}${page.path}`);
    assert.equal(meta.title, page.title);
    assert.ok(typeof meta.description === "string" && meta.description.length >= 120);
    assert.ok(typeof meta.description === "string" && meta.description.length <= 180);
    assert.equal(meta.openGraph?.url, `${SITE_URL}${page.path}`);
    assert.equal(meta.openGraph?.siteName, "Notificas");
    assert.equal(meta.openGraph?.locale, "es_AR");
    assert.equal((meta.openGraph as { type?: string } | undefined)?.type, "article");
    const robotsMeta = meta.robots;
    assert.ok(robotsMeta && typeof robotsMeta === "object" && !Array.isArray(robotsMeta));
    assert.equal((robotsMeta as { index?: boolean }).index, true);
    assert.equal((robotsMeta as { follow?: boolean }).follow, true);
  }
});

test("rutas privadas conservan noindex", () => {
  const login = createPageMetadata({
    title: "Iniciar sesión",
    description: "Acceso a la cuenta.",
    path: "/login",
    noIndex: true,
  });
  const robotsMeta = login.robots;
  assert.ok(robotsMeta && typeof robotsMeta === "object");
  assert.equal((robotsMeta as { index?: boolean }).index, false);
  assert.equal((NO_INDEX_METADATA.robots as { index?: boolean }).index, false);
});

test("JSON-LD de entidad y artículos es JSON válido", () => {
  const payloads = [
    organizationJsonLd(),
    websiteJsonLd(),
    softwareApplicationJsonLd(),
    articleJsonLd({
      title: "Prueba",
      description: "Desc",
      path: "/notificacion-whatsapp",
    }),
    breadcrumbJsonLd([
      { name: "Inicio", path: "/" },
      { name: "Recursos", path: "/recursos" },
    ]),
    faqPageJsonLd([{ question: "¿Se puede intimar una deuda por WhatsApp?", answer: "Depende." }]),
  ];
  for (const payload of payloads) {
    const parsed = JSON.parse(JSON.stringify(payload));
    assert.equal(typeof parsed["@type"], "string");
  }
  assert.equal(organizationJsonLd().name, "Notificas");
  assert.equal(softwareApplicationJsonLd().operatingSystem, "Web");
  assert.equal(softwareApplicationJsonLd().applicationCategory, "BusinessApplication");
  assert.equal(websiteJsonLd().url, SITE_URL);
});

test("existen las páginas públicas nuevas y no marcan noindex en el fuente", () => {
  for (const page of GEO_LANDING_PAGES) {
    const file = path.join(appDir, page.path.slice(1), "page.tsx");
    assert.equal(fs.existsSync(file), true, `falta ${file}`);
    const src = fs.readFileSync(file, "utf8");
    assert.match(src, /createPageMetadata/);
    assert.doesNotMatch(src, /noIndex:\s*true/);
    assert.match(src, /PublicArticle/);
    assert.match(src, /lead=/);
  }
  assert.equal(fs.existsSync(path.join(appDir, "recursos/page.tsx")), true);
  assert.equal(fs.existsSync(path.join(appDir, "llms.txt/route.ts")), true);
  assert.equal(fs.existsSync(path.join(appDir, "robots.ts")), true);
  assert.equal(fs.existsSync(path.join(appDir, "sitemap.ts")), true);
});

test("llms.txt responde texto plano con URLs públicas y sin secretos", async () => {
  const res = llmsTxtGet();
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type") || "", /text\/plain/);
  const body = await res.text();
  assert.match(body, /Notificas/);
  assert.match(body, /notificacion-whatsapp/);
  assert.doesNotMatch(body, /FIREBASE_PRIVATE_KEY/);
  assert.doesNotMatch(body, /WHATSAPP_ACCESS_TOKEN/);
  assert.doesNotMatch(body, /CAMPAIGN_WORKER_SECRET/);
});

test("referers de IA y UTM se reconocen sin inventar fuentes", () => {
  assert.equal(matchAiReferrerHost("www.chatgpt.com"), "chatgpt.com");
  assert.equal(matchAiReferrerHost("claude.ai"), "claude.ai");
  assert.equal(matchAiReferrerHost("www.perplexity.ai"), "perplexity.ai");
  assert.equal(matchAiReferrerHost("copilot.microsoft.com"), "copilot.microsoft.com");
  assert.equal(matchAiReferrerHost("evil.example"), null);
  const utm = utmParamsFromSearch("?utm_source=chatgpt.com&utm_medium=referral&foo=1");
  assert.equal(utm.utm_source, "chatgpt.com");
  assert.equal(utm.utm_medium, "referral");
  assert.equal(utm.foo, undefined);
});
