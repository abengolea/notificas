import { test } from "node:test";
import assert from "node:assert/strict";
import {
  EXTENSION_ACCESS_TTL_SEC,
  EXTENSION_REFRESH_TTL_SEC,
  EXTENSION_TOKEN_AUD,
  EXTENSION_TOKEN_ISS,
  issueExtensionSession,
  passwordsEqual,
  verifyExtensionToken,
} from "./linkedin-assistant-tokens";

const SECRET = "test-extension-signing-secret";
const EMAIL = "admin@notificas.com.ar";

test("issueExtensionSession signs access and refresh with expected claims", () => {
  const prevEmail = process.env.ADMIN_PANEL_EMAIL;
  const prevAllowed = process.env.ADMIN_ALLOWED_EMAILS;
  process.env.ADMIN_PANEL_EMAIL = EMAIL;
  delete process.env.ADMIN_ALLOWED_EMAILS;
  try {
    const now = Date.parse("2026-09-25T12:00:00.000Z");
    const session = issueExtensionSession(EMAIL, SECRET, now);
    const access = verifyExtensionToken(session.accessToken, SECRET, "ext_access", now);
    const refresh = verifyExtensionToken(session.refreshToken, SECRET, "ext_refresh", now);
    assert.equal(access.ok, true);
    assert.equal(refresh.ok, true);
    if (!access.ok || !refresh.ok) return;
    assert.equal(access.payload.e, EMAIL);
    assert.equal(access.payload.iss, EXTENSION_TOKEN_ISS);
    assert.equal(access.payload.aud, EXTENSION_TOKEN_AUD);
    assert.equal(access.payload.exp - access.payload.iat, EXTENSION_ACCESS_TTL_SEC);
    assert.equal(refresh.payload.exp - refresh.payload.iat, EXTENSION_REFRESH_TTL_SEC);
    assert.ok(refresh.payload.jti);
    assert.equal(session.expiresIn, EXTENSION_ACCESS_TTL_SEC);
  } finally {
    if (prevEmail === undefined) delete process.env.ADMIN_PANEL_EMAIL;
    else process.env.ADMIN_PANEL_EMAIL = prevEmail;
    if (prevAllowed === undefined) delete process.env.ADMIN_ALLOWED_EMAILS;
    else process.env.ADMIN_ALLOWED_EMAILS = prevAllowed;
  }
});

test("verifyExtensionToken distinguishes expired vs invalid", () => {
  const prevEmail = process.env.ADMIN_PANEL_EMAIL;
  process.env.ADMIN_PANEL_EMAIL = EMAIL;
  try {
    const issuedAt = Date.parse("2026-09-25T12:00:00.000Z");
    const session = issueExtensionSession(EMAIL, SECRET, issuedAt);
    const expired = verifyExtensionToken(
      session.accessToken,
      SECRET,
      "ext_access",
      issuedAt + (EXTENSION_ACCESS_TTL_SEC + 1) * 1000,
    );
    assert.deepEqual(expired, { ok: false, reason: "expired" });
    assert.equal(verifyExtensionToken("not-a-token", SECRET, "ext_access", issuedAt).reason, "invalid");
    assert.equal(
      verifyExtensionToken(session.refreshToken, SECRET, "ext_access", issuedAt).reason,
      "invalid",
    );
  } finally {
    if (prevEmail === undefined) delete process.env.ADMIN_PANEL_EMAIL;
    else process.env.ADMIN_PANEL_EMAIL = prevEmail;
  }
});

test("passwordsEqual is length-safe", () => {
  assert.equal(passwordsEqual("secret", "secret"), true);
  assert.equal(passwordsEqual("secret", "secretx"), false);
  assert.equal(passwordsEqual("", "x"), false);
});
