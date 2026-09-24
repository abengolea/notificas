import { test } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import {
  assertLinkedInAssistantAuth,
  bearerFromRequest,
  linkedInAssistantToken,
} from "./linkedin-assistant-auth";

test("bearerFromRequest extracts token", () => {
  const req = new NextRequest("http://localhost/api/test", {
    headers: { Authorization: "Bearer secret-token" },
  });
  assert.equal(bearerFromRequest(req), "secret-token");
});

test("assertLinkedInAssistantAuth accepts bearer when env token matches", () => {
  const prev = process.env.LINKEDIN_ASSISTANT_TOKEN;
  process.env.LINKEDIN_ASSISTANT_TOKEN = "test-assistant-token";
  try {
    const req = new NextRequest("http://localhost/api/linkedin-assistant/next", {
      headers: { Authorization: "Bearer test-assistant-token" },
    });
    assert.equal(assertLinkedInAssistantAuth(req), null);
  } finally {
    if (prev === undefined) delete process.env.LINKEDIN_ASSISTANT_TOKEN;
    else process.env.LINKEDIN_ASSISTANT_TOKEN = prev;
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
