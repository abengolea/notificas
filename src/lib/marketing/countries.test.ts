import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCountry } from "./countries";
import { contactIdForEmail, parseContactCsv, parseCsvText } from "./csv";
import { applyMergeFields, wrapTrackedLinks } from "./html";
import { matchReplyToSends } from "./reply-match";
import { nextStage, isSendableStage } from "./stages";
import { signMarketingToken, verifyMarketingToken, decodeClickTarget } from "./tokens";

test("parsea países por ISO y alias", () => {
  assert.equal(parseCountry("AR"), "AR");
  assert.equal(parseCountry("brasil"), "BR");
  assert.equal(parseCountry("España"), "ES");
  assert.equal(parseCountry("mexico"), "MX");
  assert.equal(parseCountry("United States"), null);
});

test("CSV con comillas y países", () => {
  const csv = `email,nombre,empresa,pais
"ana@a.cl","Ana, Pérez","Sur Ltd","CL"
invalido,x,y,CL
ok@b.com.br,Joao,Acme,BR
ok@b.com.br,dup,Acme,BR
`;
  const parsed = parseContactCsv(csv);
  assert.equal(parsed.rows.length, 2);
  assert.equal(parsed.rows[0].name, "Ana, Pérez");
  assert.equal(parsed.rows[0].country, "CL");
  assert.equal(parsed.rows[1].country, "BR");
  assert.equal(parsed.skipped, 1);
  assert.ok(parsed.errors.some((e) => e.message.includes("inválido")));
});

test("CSV sin columna email falla", () => {
  const parsed = parseContactCsv("nombre,pais\nAna,AR\n");
  assert.equal(parsed.rows.length, 0);
  assert.equal(parsed.errors[0].message.includes("email"), true);
});

test("parseCsvText respeta comillas", () => {
  const rows = parseCsvText('a,"b,c",d\n1,2,3\n');
  assert.deepEqual(rows[0], ["a", "b,c", "d"]);
});

test("contactId es estable por email", () => {
  assert.equal(contactIdForEmail("A@x.com"), contactIdForEmail("a@x.com"));
  assert.notEqual(contactIdForEmail("a@x.com"), contactIdForEmail("b@x.com"));
});

test("etapas no bajan ni pisan baja", () => {
  assert.equal(nextStage("sent", "opened"), "opened");
  assert.equal(nextStage("replied", "opened"), "replied");
  assert.equal(nextStage("unsubscribed", "opened"), "unsubscribed");
  assert.equal(nextStage("new", "not_interested"), "not_interested");
  assert.equal(isSendableStage("bounced"), false);
  assert.equal(isSendableStage("new"), true);
});

test("tokens HMAC de tracking", () => {
  const token = signMarketingToken("o", "abc123xyz");
  assert.equal(verifyMarketingToken(token, "o"), "abc123xyz");
  assert.equal(verifyMarketingToken(token, "c"), null);
  assert.equal(verifyMarketingToken("tampered." + token, "o"), null);
  const url = "https://notificas.com/planes";
  const encoded = Buffer.from(url, "utf8").toString("base64url");
  const click = signMarketingToken("c", "send1", encoded);
  assert.equal(verifyMarketingToken(click, "c", encoded), "send1");
  assert.equal(decodeClickTarget(encoded), "https://notificas.com/planes");
  assert.equal(decodeClickTarget(Buffer.from("javascript:alert(1)", "utf8").toString("base64url")), null);
});

test("merge fields y wrap de links", () => {
  const out = applyMergeFields("Hola {{nombre}} de {{empresa}}", {
    nombre: "Ana",
    empresa: "Sur",
    pais: "Chile",
    cargo: "",
    email: "a@x.cl",
  });
  assert.equal(out, "Hola Ana de Sur");
  const html = wrapTrackedLinks('<a href="https://notificas.com">x</a>', "send99");
  assert.match(html, /\/api\/marketing\/c\//);
  assert.doesNotMatch(html, /href="https:\/\/notificas.com"/);
});

test("matching de respuestas Gmail", () => {
  const sends = [
    {
      id: "s1",
      email: "ana@empresa.cl",
      rfcMessageId: "<abc@resend.dev>",
      subject: "Hola Notificas",
      campaignId: "c1",
      contactId: "p1",
    },
    {
      id: "s2",
      email: "joao@acme.com.br",
      rfcMessageId: "<zzz@resend.dev>",
      subject: "Brasil",
      campaignId: "c2",
      contactId: "p2",
    },
  ];
  const byId = matchReplyToSends({
    headers: { "in-reply-to": "<abc@resend.dev>", from: "Ana <ana@empresa.cl>" },
    snippet: "ok",
    sends,
  });
  assert.equal(byId?.sendId, "s1");
  const byFrom = matchReplyToSends({
    headers: { from: "joao@acme.com.br", subject: "Re: Brasil" },
    snippet: "sim",
    sends,
  });
  assert.equal(byFrom?.sendId, "s2");
  const miss = matchReplyToSends({
    headers: { from: "otro@x.com", subject: "hola" },
    snippet: "",
    sends,
  });
  assert.equal(miss, null);
});
