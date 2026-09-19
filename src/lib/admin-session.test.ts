import assert from "node:assert/strict";
import { test } from "node:test";

import {
  getAdminAllowedEmails,
  isAdminAllowedEmail,
  readAdminSessionEmail,
  signAdminSession,
  verifyAdminSessionToken,
} from "./admin-session";

const SECRET = "test-admin-session-secret-32chars!!";

function withAdminEnv(env: Record<string, string | undefined>, fn: () => void) {
  const keys = ["ADMIN_PANEL_EMAIL", "ADMIN_PANEL_PASSWORD", "ADMIN_SESSION_SECRET", "ADMIN_ALLOWED_EMAILS"];
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  try {
    for (const key of keys) {
      const value = env[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    fn();
  } finally {
    for (const key of keys) {
      const value = previous[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test("Google admin: ADMIN_PANEL_EMAIL entra a la allowlist", () => {
  withAdminEnv(
    {
      ADMIN_PANEL_EMAIL: "Admin@Notificas.com",
      ADMIN_PANEL_PASSWORD: "secret",
      ADMIN_SESSION_SECRET: SECRET,
    },
    () => {
      assert.deepEqual(getAdminAllowedEmails(), ["admin@notificas.com"]);
      assert.equal(isAdminAllowedEmail("admin@notificas.com"), true);
      assert.equal(isAdminAllowedEmail("otro@notificas.com"), false);
    },
  );
});

test("Google admin: ADMIN_ALLOWED_EMAILS suma cuentas extra", () => {
  withAdminEnv(
    {
      ADMIN_PANEL_EMAIL: "admin@notificas.com",
      ADMIN_ALLOWED_EMAILS: "Extra@Gmail.com, colaborador@notificas.com",
    },
    () => {
      assert.deepEqual(getAdminAllowedEmails(), [
        "admin@notificas.com",
        "extra@gmail.com",
        "colaborador@notificas.com",
      ]);
      assert.equal(isAdminAllowedEmail("extra@gmail.com"), true);
    },
  );
});

test("la cookie de un email extra de Google es válida", () => {
  withAdminEnv(
    {
      ADMIN_PANEL_EMAIL: "admin@notificas.com",
      ADMIN_ALLOWED_EMAILS: "google.admin@gmail.com",
      ADMIN_SESSION_SECRET: SECRET,
    },
    () => {
      const token = signAdminSession("google.admin@gmail.com", SECRET);
      assert.equal(verifyAdminSessionToken(token, SECRET, "admin@notificas.com"), true);
      assert.equal(readAdminSessionEmail(token, SECRET, "admin@notificas.com"), "google.admin@gmail.com");
    },
  );
});

test("una cookie de un email no autorizado no pasa", () => {
  withAdminEnv(
    {
      ADMIN_PANEL_EMAIL: "admin@notificas.com",
      ADMIN_SESSION_SECRET: SECRET,
    },
    () => {
      const token = signAdminSession("intruso@gmail.com", SECRET);
      assert.equal(verifyAdminSessionToken(token, SECRET, "admin@notificas.com"), false);
      assert.equal(readAdminSessionEmail(token, SECRET, "admin@notificas.com"), null);
    },
  );
});
