import { test } from "node:test";
import assert from "node:assert/strict";
import { assembleMarketingHtml, MARKETING_LOGO_WORDMARK_URL } from "./html";
import { outreachOfferBodyHtml, OUTREACH_SUBJECT } from "./offer-letter";
import { marketingUnsubUrl } from "./tokens";
import { marketingContactEmail } from "./types";

test("el correo de marketing lleva un solo wordmark público", () => {
  const prevFrom = process.env.MARKETING_FROM_EMAIL;
  const prevContact = process.env.MARKETING_CONTACT_EMAIL;
  delete process.env.MARKETING_FROM_EMAIL;
  delete process.env.MARKETING_CONTACT_EMAIL;
  try {
    const { html } = assembleMarketingHtml({
      bodyHtml: "<p>Hola {{nombre}}</p>",
      sendId: "send1",
      contactId: "contact1",
      fields: { nombre: "Adrián", empresa: "", pais: "", cargo: "", email: "a@x.com" },
    });
    assert.match(html, new RegExp(MARKETING_LOGO_WORDMARK_URL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.equal((html.match(/notificasLogo\.png/g) || []).length, 0);
    assert.equal((html.match(/notificas-wordmark\.png/g) || []).length, 1);
    assert.match(html, /Hola Adrián/);
    assert.match(html, /#F4F8FD/);
    assert.match(html, /Darse de baja/);
    assert.equal(/localhost/.test(html), false);
  } finally {
    if (prevFrom === undefined) delete process.env.MARKETING_FROM_EMAIL;
    else process.env.MARKETING_FROM_EMAIL = prevFrom;
    if (prevContact === undefined) delete process.env.MARKETING_CONTACT_EMAIL;
    else process.env.MARKETING_CONTACT_EMAIL = prevContact;
  }
});

test("la baja de marketing apunta a producción", () => {
  const prev = process.env.NEXT_PUBLIC_APP_URL;
  process.env.NEXT_PUBLIC_APP_URL = "http://localhost:9006";
  try {
    const url = marketingUnsubUrl("abc123xyz");
    assert.match(url, /^https:\/\//);
    assert.match(url, /\/api\/marketing\/u\//);
    assert.doesNotMatch(url, /localhost/);
  } finally {
    if (prev === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
    else process.env.NEXT_PUBLIC_APP_URL = prev;
  }
});

test("el contacto visible del correo es contacto@notificas.com", () => {
  const prev = process.env.MARKETING_CONTACT_EMAIL;
  delete process.env.MARKETING_CONTACT_EMAIL;
  try {
    assert.equal(marketingContactEmail(), "contacto@notificas.com");
  } finally {
    if (prev === undefined) delete process.env.MARKETING_CONTACT_EMAIL;
    else process.env.MARKETING_CONTACT_EMAIL = prev;
  }
});

test("la carta de oferta no promete carta documento", () => {
  const body = outreachOfferBodyHtml({
    nombre: "Adrián",
    empresa: "",
    pais: "",
    cargo: "",
    email: "a@x.com",
  });
  assert.match(body, /No reemplaza una carta documento/);
  assert.match(OUTREACH_SUBJECT, /Constancia/);
});
