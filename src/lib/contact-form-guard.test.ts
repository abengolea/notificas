import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CONTACT_FORM_CLIENT_HEADER_VALUE,
  CONTACT_MAX_AGE_MS,
  CONTACT_MIN_DWELL_MS,
  contactRateLimitKey,
  evaluateContactSpam,
  hasContactFormClientHeader,
} from "./contact-form-guard";

const now = 1_700_000_000_000;

function legit(over: Partial<Parameters<typeof evaluateContactSpam>[0]> = {}) {
  return evaluateContactSpam({
    nombre: "María Pérez",
    email: "maria@estudio.com",
    mensaje: "Quiero cotizar notificaciones por WhatsApp.",
    formStartedAt: now - 8_000,
    now,
    ...over,
  });
}

test("un pedido real pasa", () => {
  assert.deepEqual(legit(), { drop: false });
});

test("el honeypot descarta sin importar el resto", () => {
  assert.deepEqual(legit({ website: "https://spam.example" }), {
    drop: true,
    reason: "honeypot",
  });
  assert.deepEqual(legit({ website: "   " }), { drop: false });
});

test("sin tiempo de permanencia o envío instantáneo se descarta", () => {
  assert.deepEqual(legit({ formStartedAt: undefined }), { drop: true, reason: "too_fast" });
  assert.deepEqual(legit({ formStartedAt: now - (CONTACT_MIN_DWELL_MS - 1) }), {
    drop: true,
    reason: "too_fast",
  });
  assert.deepEqual(legit({ formStartedAt: now - CONTACT_MIN_DWELL_MS }), { drop: false });
});

test("un formulario dejado abierto más de 12 h se descarta", () => {
  assert.deepEqual(legit({ formStartedAt: now - CONTACT_MAX_AGE_MS - 1 }), {
    drop: true,
    reason: "stale",
  });
});

test("un solo enlace corporativo no es spam; tres sí", () => {
  assert.deepEqual(
    legit({ mensaje: "Nuestro sitio es https://estudio.com.ar y queremos una demo." }),
    { drop: false }
  );
  assert.deepEqual(
    legit({
      mensaje: "Visit https://a.com https://b.com and www.cheap-pills.test for more",
    }),
    { drop: true, reason: "content" }
  );
});

test("frases típicas de SEO / pharma se descartan", () => {
  assert.deepEqual(legit({ mensaje: "We offer guest post and link building." }), {
    drop: true,
    reason: "content",
  });
});

test("texto mayormente chino o cirílico se descarta", () => {
  assert.deepEqual(
    legit({
      nombre: "测试用户",
      mensaje: "这是一个推广链接的垃圾邮件内容请访问我们的网站购买产品优惠",
    }),
    { drop: true, reason: "content" }
  );
});

test("dominios desechables se descartan; gmail no", () => {
  assert.deepEqual(legit({ email: "bot@mailinator.com" }), {
    drop: true,
    reason: "disposable_email",
  });
  assert.deepEqual(legit({ email: "juan@gmail.com" }), { drop: false });
});

test("el header del cliente es el valor web, sin importar mayúsculas", () => {
  assert.equal(hasContactFormClientHeader("web"), true);
  assert.equal(hasContactFormClientHeader("WEB"), true);
  assert.equal(hasContactFormClientHeader("  web  "), true);
  assert.equal(hasContactFormClientHeader(null), false);
  assert.equal(hasContactFormClientHeader("xmlhttprequest"), false);
  assert.equal(CONTACT_FORM_CLIENT_HEADER_VALUE, "web");
});

test("la clave de rate limit sanitiza el X-Forwarded-For", () => {
  const key = contactRateLimitKey("1.2.3.4/../../x y");
  assert.equal(contactRateLimitKey("203.0.113.7"), "contact_203.0.113.7");
  assert.match(key, /^contact_[a-zA-Z0-9:._-]+$/);
  assert.equal(key.includes("/"), false);
  assert.equal(key.includes(" "), false);
});
