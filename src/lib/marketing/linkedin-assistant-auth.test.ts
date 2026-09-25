import { test } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import {
  assertLinkedInAssistantAuth,
  bearerFromRequest,
  isChromeExtensionOrigin,
  linkedInAssistantCorsHeaders,
  linkedInAssistantToken,
} from "./linkedin-assistant-auth";
import { issueExtensionSession } from "./linkedin-assistant-tokens";

test("bearerFromRequest extracts token", () => {
  const req = new NextRequest("http://localhost/api/test", {
    headers: { Authorization: "Bearer secret-token" },
  });
  assert.equal(bearerFromRequest(req), "secret-token");
});

test("assertLinkedInAssistantAuth accepts bearer when env token matches in non-production", () => {
  const prev = process.env.LINKEDIN_ASSISTANT_TOKEN;
  const prevNode = process.env.NODE_ENV;
  process.env.LINKEDIN_ASSISTANT_TOKEN = "test-assistant-token";
  process.env.NODE_ENV = "test";
  try {
    const req = new NextRequest("http://localhost/api/linkedin-assistant/next", {
      headers: { Authorization: "Bearer test-assistant-token" },
    });
    assert.equal(assertLinkedInAssistantAuth(req), null);
  } finally {
    if (prev === undefined) delete process.env.LINKEDIN_ASSISTANT_TOKEN;
    else process.env.LINKEDIN_ASSISTANT_TOKEN = prev;
    process.env.NODE_ENV = prevNode;
  }
});

test("linkedInAssistantToken reads env", () => {
  const prev = process.env.LINKEDIN_ASSISTANT_TOKEN;
  process.env.LINKEDIN_ASSISTANT_TOKEN = "  abc  ";
  try {
    assert.equal(linkedInAssistantToken(), "abc");
  } finally {
    if (prev === undefined) delete process.env.LINKEDIN_ASSISTANT_TOKEN;
    else process.env.LINKEDIN_ASSISTANT_TOKEN = prev;
  }
});

test("assertLinkedInAssistantAuth accepts signed access token", () => {
  const prevEmail = process.env.ADMIN_PANEL_EMAIL;
  const prevPassword = process.env.ADMIN_PANEL_PASSWORD;
  const prevSecret = process.env.ADMIN_SESSION_SECRET;
  process.env.ADMIN_PANEL_EMAIL = "admin@notificas.com.ar";
  process.env.ADMIN_PANEL_PASSWORD = "panel-password";
  process.env.ADMIN_SESSION_SECRET = "signing-secret-for-tests";
  try {
    const session = issueExtensionSession("admin@notificas.com.ar", "signing-secret-for-tests");
    const req = new NextRequest("http://localhost/api/linkedin-assistant/campaigns", {
      headers: { Authorization: `Bearer ${session.accessToken}` },
    });
    assert.equal(assertLinkedInAssistantAuth(req), null);
  } finally {
    if (prevEmail === undefined) delete process.env.ADMIN_PANEL_EMAIL;
    else process.env.ADMIN_PANEL_EMAIL = prevEmail;
    if (prevPassword === undefined) delete process.env.ADMIN_PANEL_PASSWORD;
    else process.env.ADMIN_PANEL_PASSWORD = prevPassword;
    if (prevSecret === undefined) delete process.env.ADMIN_SESSION_SECRET;
    else process.env.ADMIN_SESSION_SECRET = prevSecret;
  }
});

test("CORS allows chrome-extension origins and not arbitrary https", () => {
  const ext = "chrome-extension://abcdefghijklmnopqrstuvwxyzabcdef";
  const headers = linkedInAssistantCorsHeaders(ext) as Record<string, string>;
  assert.equal(headers["Access-Control-Allow-Origin"], ext);
  assert.equal(isChromeExtensionOrigin(ext), true);
  const blocked = linkedInAssistantCorsHeaders("https://evil.example") as Record<string, string>;
  assert.equal(blocked["Access-Control-Allow-Origin"], undefined);
});
