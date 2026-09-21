import { test } from "node:test";
import assert from "node:assert/strict";
import { assembleMarketingHtml } from "./html";
import {
  applyMergeFields,
  buildMergeFields,
  firstNameFromFullName,
  hasUnresolvedMergePlaceholders,
} from "./merge-fields";
import { blankCampaignEmailContent, persistCampaignEmail, previewCampaignEmail } from "./campaign-email";

test("firstName usa el primer token y queda vacío si no hay nombre", () => {
  assert.equal(firstNameFromFullName("César Pérez"), "César");
  assert.equal(firstNameFromFullName("Francisco"), "Francisco");
  assert.equal(firstNameFromFullName("  Alejandro  Ortiz "), "Alejandro");
  assert.equal(firstNameFromFullName(""), "");
  assert.equal(firstNameFromFullName("   "), "");
});

test("buildMergeFields mapea CRM y alias legacy", () => {
  const fields = buildMergeFields({
    name: "César Pérez",
    company: "contacto string",
    companyName: "YPF S.A.",
    title: "Gerente de Operaciones",
    countryName: "Argentina",
    email: "cesar@ypf.com",
  });
  assert.equal(fields.firstName, "César");
  assert.equal(fields.fullName, "César Pérez");
  assert.equal(fields.companyName, "YPF S.A.");
  assert.equal(fields.jobTitle, "Gerente de Operaciones");
  assert.equal(fields.nombre, "César Pérez");
  assert.equal(fields.empresa, "YPF S.A.");
  assert.equal(fields.cargo, "Gerente de Operaciones");
  assert.equal(fields.pais, "Argentina");
  assert.equal(fields.email, "cesar@ypf.com");
});

test("Hola {{firstName}} personaliza o no deja el saludo roto", () => {
  const named = applyMergeFields("Hola {{firstName}},", buildMergeFields({ name: "César Pérez" }));
  const unnamed = applyMergeFields("Hola {{firstName}},", buildMergeFields({ name: "" }));
  const spaces = applyMergeFields("Hola {{ firstName }},", { firstName: "" });
  assert.equal(named, "Hola César,");
  assert.equal(unnamed, "Hola,");
  assert.equal(spaces, "Hola,");
  assert.equal(hasUnresolvedMergePlaceholders(named), false);
  assert.equal(hasUnresolvedMergePlaceholders(unnamed), false);
  assert.doesNotMatch(named, /\{\{\s*firstName\s*\}\}/);
  assert.doesNotMatch(unnamed, /\{\{\s*firstName\s*\}\}/);
});

test("nunca deja placeholders sin resolver, ni en HTML ni en texto", () => {
  const html = applyMergeFields(
    "<p>Hola {{firstName}}, de {{companyName}} {{unknownField}}</p>",
    buildMergeFields({ name: "Francisco", company: "Acme" }),
    { escapeHtml: true },
  );
  const text = applyMergeFields("Hola {{firstName}}, {{missing}} listo.", buildMergeFields({ name: "Alejandro" }));
  assert.equal(html, "<p>Hola Francisco, de Acme </p>");
  assert.equal(text, "Hola Alejandro,  listo.");
  assert.equal(hasUnresolvedMergePlaceholders(html), false);
  assert.equal(hasUnresolvedMergePlaceholders(text), false);
  assert.doesNotMatch(html, /\{\{/);
  assert.doesNotMatch(text, /\{\{/);
});

test("los valores insertados en HTML se escapan y en texto plano no", () => {
  const source = { name: 'Ana <script>x</script>', company: 'Sur & Co "Ltd"' };
  const html = applyMergeFields("<p>{{fullName}} · {{companyName}}</p>", buildMergeFields(source), {
    escapeHtml: true,
  });
  const text = applyMergeFields("{{fullName}} · {{companyName}}", buildMergeFields(source));
  assert.match(html, /Ana &lt;script&gt;x&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /Sur &amp; Co &quot;Ltd&quot;/);
  assert.equal(text, 'Ana <script>x</script> · Sur & Co "Ltd"');
});

test("las campañas existentes con {{nombre}} y {{empresa}} siguen interpolando", () => {
  const out = applyMergeFields("Hola {{nombre}} de {{empresa}}", {
    nombre: "Ana",
    empresa: "Sur",
    pais: "Chile",
    cargo: "",
    email: "a@x.cl",
  });
  assert.equal(out, "Hola Ana de Sur");
  assert.equal(applyMergeFields("Hola {{firstName}},", { nombre: "César Pérez" }), "Hola César,");
});

test("se pueden agregar variables extra sin cambiar el motor", () => {
  const out = applyMergeFields("LinkedIn: {{linkedinUrl}}", { linkedinUrl: "https://linkedin.com/in/cesar" });
  assert.equal(out, "LinkedIn: https://linkedin.com/in/cesar");
});

test("el snapshot de campaña conserva placeholders hasta el envío", () => {
  const snapshot = persistCampaignEmail({
    ...blankCampaignEmailContent({
      title: "Comunicaciones trazables",
      introduction: "Hola {{firstName}},",
      paragraphs: ["Notificas para {{companyName}}."],
    }),
    name: "Prueba merge",
    subject: "Hola {{firstName}}",
  });
  assert.match(snapshot.htmlBody, /\{\{\s*firstName\s*\}\}/);
  assert.match(snapshot.textBody, /\{\{\s*firstName\s*\}\}/);
  assert.match(snapshot.htmlBody, /\{\{\s*companyName\s*\}\}/);
});

test("preview y assemble personalizan HTML y texto con un destinatario de muestra", () => {
  const content = blankCampaignEmailContent({
    title: "Comunicaciones trazables",
    introduction: "Hola {{firstName}},",
    paragraphs: ["Trabajamos con {{companyName}}."],
  });
  const preview = previewCampaignEmail(content, buildMergeFields({ name: "César Pérez", company: "YPF S.A." }));
  assert.match(preview.html, /Hola César,/);
  assert.match(preview.text, /Hola César,/);
  assert.match(preview.html, /Trabajamos con YPF S\.A\./);
  assert.doesNotMatch(preview.html, /\{\{\s*firstName\s*\}\}/);
  assert.doesNotMatch(preview.text, /\{\{\s*firstName\s*\}\}/);

  const unnamed = previewCampaignEmail(content, buildMergeFields({ name: "", company: "YPF S.A." }));
  assert.match(unnamed.html, /Hola,/);
  assert.doesNotMatch(unnamed.html, /Hola ,/);
  assert.doesNotMatch(unnamed.html, /\{\{\s*firstName\s*\}\}/);

  const assembled = assembleMarketingHtml({
    bodyHtml: "<p>Hola {{firstName}},</p><p>{{jobTitle}} en {{companyName}}</p>",
    textBody: "Hola {{firstName}},\n{{jobTitle}} en {{companyName}}",
    sendId: "send1",
    contactId: "contact1",
    fields: buildMergeFields({
      name: "César Pérez",
      company: "YPF S.A.",
      title: "Gerente",
    }),
    trackLinks: false,
    injectPixel: false,
  });
  assert.match(assembled.html, /Hola César,/);
  assert.match(assembled.text, /Hola César,/);
  assert.match(assembled.html, /Gerente en YPF S\.A\./);
  assert.match(assembled.text, /Gerente en YPF S\.A\./);
  assert.doesNotMatch(assembled.html, /\{\{\s*firstName\s*\}\}/);
  assert.doesNotMatch(assembled.text, /\{\{\s*firstName\s*\}\}/);
});
