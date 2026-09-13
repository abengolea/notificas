import { test } from "node:test";
import assert from "node:assert/strict";
import {
  artWhatsAppOtpLanguages,
  artWhatsAppOtpTemplateName,
  buildWhatsAppAuthOtpPayload,
  whatsAppOtpToDigits,
} from "./whatsapp-auth-otp";

test("AUTH OTP usa la plantilla aprobada y el mismo código en body y Copiar código", () => {
  const payload = buildWhatsAppAuthOtpPayload({
    to: "5493364645357",
    code: "123456",
    templateName: "notificas_verificacion_identidad",
    language: "es",
  });
  assert.equal(payload.type, "template");
  const template = payload.template as {
    name: string;
    language: { code: string };
    components: Array<{ type: string; sub_type?: string; parameters: Array<{ text: string }> }>;
  };
  assert.equal(template.name, "notificas_verificacion_identidad");
  assert.equal(template.language.code, "es");
  assert.equal(template.components[0]?.type, "body");
  assert.equal(template.components[0]?.parameters[0]?.text, "123456");
  assert.equal(template.components[1]?.type, "button");
  assert.equal(template.components[1]?.sub_type, "url");
  assert.equal(template.components[1]?.parameters[0]?.text, "123456");
  assert.equal("id" in template, false);
});

test("AUTH OTP no puede llevar el enlace de adhesión", () => {
  const payload = JSON.stringify(
    buildWhatsAppAuthOtpPayload({
      to: "5493364645357",
      code: "654321",
      templateName: "notificas_verificacion_identidad",
      language: "es",
    })
  );
  assert.equal(payload.includes("/adherir/"), false);
  assert.equal(payload.includes("http"), false);
});

test("teléfono argentino a dígitos Graph sin +", () => {
  assert.equal(whatsAppOtpToDigits("3364645357"), "5493364645357");
  assert.equal(whatsAppOtpToDigits("+5493364645357"), "5493364645357");
  assert.equal(whatsAppOtpToDigits(""), null);
});

test("defaults de plantilla AUTH Spanish", () => {
  const prevTemplate = process.env.ART_WHATSAPP_OTP_TEMPLATE;
  const prevLang = process.env.ART_WHATSAPP_OTP_LANG;
  delete process.env.ART_WHATSAPP_OTP_TEMPLATE;
  delete process.env.ART_WHATSAPP_OTP_LANG;
  try {
    assert.equal(artWhatsAppOtpTemplateName(), "notificas_verificacion_identidad");
    assert.deepEqual(artWhatsAppOtpLanguages(), ["es", "es_AR"]);
  } finally {
    if (prevTemplate === undefined) delete process.env.ART_WHATSAPP_OTP_TEMPLATE;
    else process.env.ART_WHATSAPP_OTP_TEMPLATE = prevTemplate;
    if (prevLang === undefined) delete process.env.ART_WHATSAPP_OTP_LANG;
    else process.env.ART_WHATSAPP_OTP_LANG = prevLang;
  }
});
