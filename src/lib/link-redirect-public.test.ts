import assert from "node:assert/strict";
import { test } from "node:test";

import {
  isLinkPreviewCrawler,
  isReaderCtaQuery,
  publicReaderOriginFromHeaders,
  readerPathFromQuery,
  readerResponseOrigin,
  readerUrlOnRequestOrigin,
  rewriteLocationToRequestOrigin,
  whatsappReaderInterstitialHtml,
} from "./link-redirect-public";

function params(init: Record<string, string>) {
  const q = new URLSearchParams(init);
  return { get: (name: string) => q.get(name) };
}

test("el CTA de WhatsApp (sin u ni att) es un salto directo al reader", () => {
  assert.equal(isReaderCtaQuery(params({ msg: "abc", k: "tok", src: "whatsapp" })), true);
  assert.equal(isReaderCtaQuery(params({ msg: "abc", k: "tok", u: "xxxx" })), false);
  assert.equal(isReaderCtaQuery(params({ msg: "abc", k: "tok", att: "file-1" })), false);
  assert.equal(isReaderCtaQuery(params({ k: "tok" })), false);
});

test("el reader queda en .com.ar aunque el link se abra en .com o www", () => {
  assert.equal(readerResponseOrigin("https://notificas.com.ar"), "https://notificas.com.ar");
  assert.equal(readerResponseOrigin("https://www.notificas.com.ar"), "https://notificas.com.ar");
  assert.equal(readerResponseOrigin("https://notificas.com"), "https://notificas.com.ar");
  assert.equal(
    readerResponseOrigin("https://notificas--notificas-f9953.us-central1.hosted.app"),
    "https://notificas--notificas-f9953.us-central1.hosted.app",
  );
});

test("el 302 del CTA no manda el celular a hosted.app si abrió .com.ar", () => {
  const url = readerUrlOnRequestOrigin(
    "https://notificas.com.ar",
    params({ msg: "mail-1", k: "secret", src: "whatsapp" }),
  );
  assert.equal(
    url,
    "https://notificas.com.ar/reader/mail-1?k=secret&from=whatsapp",
  );
  assert.doesNotMatch(url, /hosted\.app/);
});

test("si el botón de Meta abre hosted.app, el reader se queda en ese mismo host", () => {
  const origin = "https://notificas--notificas-f9953.us-central1.hosted.app";
  assert.equal(
    readerUrlOnRequestOrigin(origin, params({ msg: "mail-1", k: "secret", src: "whatsapp" })),
    `${origin}/reader/mail-1?k=secret&from=whatsapp`,
  );
});

test("un Location de Cloud Function hacia hosted.app/reader se reescribe al origen público", () => {
  const rewritten = rewriteLocationToRequestOrigin(
    "https://notificas--notificas-f9953.us-central1.hosted.app/reader/mail-1?k=secret&from=whatsapp",
    "https://notificas.com.ar",
  );
  assert.equal(
    rewritten,
    "https://notificas.com.ar/reader/mail-1?k=secret&from=whatsapp",
  );
});

test("un adjunto de Storage no se reescribe al dominio de la app", () => {
  const file = "https://storage.googleapis.com/bucket/doc.pdf";
  assert.equal(rewriteLocationToRequestOrigin(file, "https://notificas.com.ar"), file);
});

test("el crawler de vista previa de WhatsApp no cuenta como pulso", () => {
  assert.equal(isLinkPreviewCrawler("WhatsApp/2.24.12.78"), true);
  assert.equal(isLinkPreviewCrawler("facebookexternalhit/1.1"), true);
  assert.equal(
    isLinkPreviewCrawler(
      "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36",
    ),
    false,
  );
  assert.equal(
    isLinkPreviewCrawler(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 WhatsApp/2.24.12.78",
    ),
    false,
  );
});

test("App Hosting no puede mandar el 302 a 0.0.0.0:8080", () => {
  const headers = {
    get(name: string) {
      if (name === "host") return "0.0.0.0:8080";
      if (name === "x-forwarded-host") return "notificas.com.ar";
      return null;
    },
  };
  assert.equal(publicReaderOriginFromHeaders(headers), "https://notificas.com.ar");
  assert.equal(
    readerUrlOnRequestOrigin(
      "https://0.0.0.0:8080",
      params({ msg: "mail-1", k: "secret", src: "whatsapp" }),
    ),
    "https://notificas.com.ar/reader/mail-1?k=secret&from=whatsapp",
  );
});

test("sin host público usable, el reader cae en .com.ar", () => {
  const headers = {
    get(name: string) {
      if (name === "host") return "0.0.0.0:8080";
      return null;
    },
  };
  assert.equal(publicReaderOriginFromHeaders(headers), "https://notificas.com.ar");
});

test("el puente de WhatsApp es HTML 200 con enlace relativo al reader", () => {
  const html = whatsappReaderInterstitialHtml("/reader/mail-1?k=secret&from=whatsapp");
  assert.match(html, /href="\/reader\/mail-1\?k=secret&amp;from=whatsapp"/);
  assert.match(html, /location\.replace\("\/reader\/mail-1\?k=secret&from=whatsapp"\)/);
  assert.doesNotMatch(html, /hosted\.app|0\.0\.0\.0/);
});

test("el path del reader lleva from=whatsapp o from=email", () => {
  assert.equal(
    readerPathFromQuery(params({ msg: "x", k: "y", src: "whatsapp" })),
    "/reader/x?k=y&from=whatsapp",
  );
  assert.equal(readerPathFromQuery(params({ msg: "x", k: "y" })), "/reader/x?k=y&from=email");
});
