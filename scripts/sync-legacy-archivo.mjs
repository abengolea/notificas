/**
 * Espeja el SPA Ionic vivo de https://notificas.com dentro de
 * public/archivo, con base href /archivo/, sin tocar producción .com.
 *
 * Uso: node scripts/sync-legacy-archivo.mjs
 */
import { createWriteStream } from "node:fs";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { pipeline } from "node:stream/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";

const ORIGIN = "https://notificas.com";
const BASE_PATH = "/archivo";
const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..");
const destDir = path.join(repoRoot, "public", "archivo");
const backupAssets = path.join(
  "c:",
  "DEV",
  "backup-notificas",
  "extracted",
  "notificas-app-src",
  "src",
  "assets"
);
const backupIoniconsSvg = path.join(
  backupAssets,
  "vendor",
  "ionicons",
  "dist",
  "ionicons",
  "svg"
);

function ensureDir(dir) {
  mkdirSync(dir, { recursive: true });
}

async function downloadToFile(url, dest) {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${url}`);
  }
  ensureDir(path.dirname(dest));
  if (!res.body) throw new Error(`sin body: ${url}`);
  await pipeline(Readable.fromWeb(res.body), createWriteStream(dest));
}

async function downloadText(url) {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return res.text();
}

function extractChunkFiles(runtimeJs) {
  const named =
    runtimeJs.match(
      /\{2214:"polyfills-core-js",6748:"polyfills-dom",8592:"common"\}/
    )?.[0] || runtimeJs.match(/\{[^}]*polyfills-core-js[^}]*\}/)?.[0];
  const hashes = runtimeJs.match(/\{(?:\d+:"[0-9a-f]+",?)+\}/g) || [];
  const hashMapMatch = hashes.find((block) => block.includes('"191ef1f9923a7444"') || /"\d+":"[0-9a-f]{12,}"/.test(block));
  const idToHash = new Map();
  if (hashMapMatch) {
    for (const m of hashMapMatch.matchAll(/(\d+):"([0-9a-f]+)"/g)) {
      idToHash.set(m[1], m[2]);
    }
  } else {
    for (const m of runtimeJs.matchAll(/(\d+):"([0-9a-f]{12,})"/g)) {
      idToHash.set(m[1], m[2]);
    }
  }
  const idToName = new Map();
  const namedMatch = runtimeJs.match(/\{(\d+:"[a-z0-9-]+",?){2,}\}/);
  if (named || namedMatch) {
    for (const m of (named || namedMatch).matchAll(/(\d+):"([a-z0-9-]+)"/g)) {
      idToName.set(m[1], m[2]);
    }
  }
  const files = new Set();
  for (const [id, hash] of idToHash) {
    const name = idToName.get(id) || id;
    files.add(`${name}.${hash}.js`);
  }
  return [...files];
}

function patchLegacyContent(content) {
  let out = content;
  out = out.replace(/f\.p=""/g, 'f.p="/archivo/"');
  out = out.replace(/f\.p=''/g, "f.p='/archivo/'");
  out = out.replaceAll("../assets/", "__ARCHIVO_ASSETS__");
  out = out.replaceAll("/archivo/assets/", "__ARCHIVO_ASSETS__");
  out = out.replaceAll("/assets/", "__ARCHIVO_ASSETS__");
  out = out.replaceAll("__ARCHIVO_ASSETS__", `${BASE_PATH}/assets/`);
  out = out.replaceAll("/archivo/svg/", "__ARCHIVO_SVG__");
  out = out.replaceAll("/svg/", "__ARCHIVO_SVG__");
  out = out.replaceAll("__ARCHIVO_SVG__", `${BASE_PATH}/svg/`);
  return out;
}

function patchIndexHtml(html) {
  let out = html;
  out = out.replace(/<base href="\/"\s*\/?>/i, `<base href="${BASE_PATH}/">`);
  if (!/name="robots"/i.test(out)) {
    out = out.replace(
      /<title>Notificas<\/title>/i,
      `<title>Notificas — archivo</title>\n  <meta name="robots" content="noindex, follow">`
    );
  }
  return patchLegacyContent(out);
}

function walkFiles(dir, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(full, acc);
    else acc.push(full);
  }
  return acc;
}

function isTextFile(file) {
  return /\.(html|js|css|json|webmanifest|txt|map)$/i.test(file);
}

async function main() {
  console.log("Limpiando", destDir);
  rmSync(destDir, { recursive: true, force: true });
  ensureDir(destDir);

  console.log("Copiando assets locales del backup…");
  if (!existsSync(backupAssets)) {
    throw new Error(`No se encontró ${backupAssets}`);
  }
  cpSync(backupAssets, path.join(destDir, "assets"), { recursive: true });
  if (existsSync(backupIoniconsSvg)) {
    cpSync(backupIoniconsSvg, path.join(destDir, "svg"), { recursive: true });
  }

  console.log("Descargando index y bundles de producción (sin modificar .com)…");
  const indexHtml = await downloadText(`${ORIGIN}/`);
  const scriptFiles = [...indexHtml.matchAll(/src="([^"]+\.js)"/g)].map((m) => m[1]);
  const styleFiles = [...indexHtml.matchAll(/href="([^"]+\.css)"/g)].map((m) => m[1]);
  const localFiles = [...scriptFiles, ...styleFiles].filter(
    (src) => src && !src.startsWith("http") && !src.startsWith("//")
  );

  writeFileSync(path.join(destDir, "index.html"), patchIndexHtml(indexHtml), "utf8");

  const extraKnown = ["3rdpartylicenses.txt"];
  for (const rel of [...new Set([...localFiles, ...extraKnown])]) {
    const clean = rel.replace(/^\.\.\//, "").replace(/^\//, "");
    try {
      await downloadToFile(`${ORIGIN}/${clean}`, path.join(destDir, clean));
      console.log("  ok", clean);
    } catch (err) {
      console.warn("  skip", clean, err.message);
    }
  }

  const runtimeFile = localFiles.find((f) => f.startsWith("runtime."));
  if (runtimeFile) {
    const runtimeJs = readFileSync(path.join(destDir, runtimeFile), "utf8");
    const chunks = extractChunkFiles(runtimeJs);
    console.log(`Descargando ${chunks.length} chunks lazy…`);
    for (const chunk of chunks) {
      try {
        await downloadToFile(`${ORIGIN}/${chunk}`, path.join(destDir, chunk));
      } catch (err) {
        console.warn("  skip chunk", chunk, err.message);
      }
    }
  }

  console.log("Parcheando publicPath y assets absolutos solo dentro de /archivo…");
  for (const file of walkFiles(destDir)) {
    if (!isTextFile(file)) continue;
    if (statSync(file).size > 8 * 1024 * 1024) continue;
    const before = readFileSync(file, "utf8");
    const after = file.endsWith("index.html") ? before : patchLegacyContent(before);
    if (after !== before) writeFileSync(file, after, "utf8");
  }

  const webmanifest = path.join(destDir, "assets", "icon", "site.webmanifest");
  if (existsSync(webmanifest)) {
    const manifest = JSON.parse(readFileSync(webmanifest, "utf8"));
    if (Array.isArray(manifest.icons)) {
      for (const icon of manifest.icons) {
        if (typeof icon.src === "string" && icon.src.startsWith("/") && !icon.src.startsWith(BASE_PATH)) {
          icon.src = `${BASE_PATH}${icon.src}`;
        }
      }
    }
    writeFileSync(webmanifest, JSON.stringify(manifest, null, 4), "utf8");
  }

  console.log("Listo:", destDir);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
