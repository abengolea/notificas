import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createContext, runInContext } from "node:vm";

type NotificasSdk = {
  version: string;
  create: (opts: Record<string, unknown>) => {
    sendCertifiedNotification: (input: Record<string, unknown>) => Promise<unknown>;
    getNotification: (id: string) => Promise<unknown>;
    listNotifications: (q?: Record<string, unknown>) => Promise<unknown>;
    getCertificate: (id: string) => Promise<unknown>;
    me: () => Promise<unknown>;
  };
  embed: (target: unknown, opts?: Record<string, unknown>) => { destroy: () => void };
  _assertBrowserKeySafe: (opts: Record<string, unknown>) => void;
  _parseVariables: (raw: unknown) => Record<string, string>;
  _resolveUrl: (opts: Record<string, unknown>, path: string) => string;
  _isLiveKey: (key: string) => boolean;
};

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    json: async () => body,
  };
}

function loadSdk(opts?: { browser?: boolean; fetchImpl?: (...args: unknown[]) => Promise<unknown> }) {
  const source = readFileSync(resolve(process.cwd(), "public/sdk/v1/notificas.js"), "utf8");
  const fetchImpl =
    opts?.fetchImpl ??
    (async () => jsonResponse(200, { id: "ntf_x", status: "queued" }));

  const sandbox: Record<string, unknown> = {
    fetch: fetchImpl,
    console,
    setTimeout,
    clearTimeout,
    Date,
    URL,
    URLSearchParams,
    Headers,
    AbortController,
    crypto: globalThis.crypto,
  };

  if (opts?.browser) {
    sandbox.window = sandbox;
    sandbox.document = {
      readyState: "complete",
      querySelector: () => null,
      querySelectorAll: () => [],
      addEventListener: () => undefined,
      createElement: () => ({
        setAttribute: () => undefined,
        appendChild: () => undefined,
        addEventListener: () => undefined,
        style: {},
        className: "",
        innerHTML: "",
        textContent: "",
      }),
      head: { appendChild: () => undefined },
      body: { appendChild: () => undefined },
    };
  }

  const ctx = createContext(sandbox);
  runInContext(source, ctx);
  return { sdk: sandbox.Notificas as NotificasSdk, fetchImpl };
}

test("SDK: version and URL helpers", () => {
  const { sdk } = loadSdk();
  assert.equal(sdk.version, "1.0.0");
  assert.equal(sdk._isLiveKey("ntf_live_abc"), true);
  assert.equal(sdk._isLiveKey("ntf_test_abc"), false);
  assert.equal(
    sdk._resolveUrl({ proxyUrl: "https://acme.test/api/notificas" }, "/api/v1/notifications"),
    "https://acme.test/api/notificas/notifications"
  );
  assert.equal(
    sdk._resolveUrl({ proxyUrl: "https://acme.test/api/notificas" }, "/api/v1/me"),
    "https://acme.test/api/notificas/me"
  );
  assert.equal(
    sdk._resolveUrl(
      { proxyUrl: "https://acme.test", proxyMapsFullPath: true },
      "/api/v1/notifications"
    ),
    "https://acme.test/api/v1/notifications"
  );
  assert.equal(
    sdk._resolveUrl({ baseUrl: "https://notificas.com.ar" }, "/api/v1/notifications"),
    "https://notificas.com.ar/api/v1/notifications"
  );
  const fromJson = sdk._parseVariables('{"nombre":"Ana"}');
  assert.equal(fromJson.nombre, "Ana");
  const fromPairs = sdk._parseVariables("nombre=Ana\nmonto=100");
  assert.equal(fromPairs.nombre, "Ana");
  assert.equal(fromPairs.monto, "100");
});

test("SDK: blocks ntf_live_ in the browser without proxy", () => {
  const { sdk } = loadSdk({ browser: true });
  assert.throws(
    () =>
      sdk._assertBrowserKeySafe({
        apiKey: "ntf_live_secret",
        proxyUrl: "",
        allowBrowserKey: false,
      }),
    /ntf_live_/
  );
  assert.doesNotThrow(() =>
    sdk._assertBrowserKeySafe({
      apiKey: "ntf_test_secret",
      proxyUrl: "",
      allowBrowserKey: false,
    })
  );
  assert.doesNotThrow(() =>
    sdk._assertBrowserKeySafe({
      apiKey: "",
      proxyUrl: "/api/notificas",
      allowBrowserKey: false,
    })
  );
});

test("SDK: proxy POST does not send the API key from the browser", async () => {
  const calls: Array<[string, { headers: Record<string, string>; body?: string }]> = [];
  const fetchImpl = async (url: string, init: { headers: Record<string, string>; body?: string }) => {
    calls.push([url, init]);
    return jsonResponse(200, { id: "ntf_x", status: "queued" });
  };
  const { sdk } = loadSdk({ fetchImpl: fetchImpl as never });
  const client = sdk.create({ proxyUrl: "https://acme.test/api/notificas" });
  await client.sendCertifiedNotification({
    channel: "email",
    recipient: { email: "ana@acme.test" },
    subject: "Aviso",
    body: "<p>Hola</p>",
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], "https://acme.test/api/notificas/notifications");
  assert.equal(calls[0][1].headers.Authorization, undefined);
  assert.equal(JSON.parse(String(calls[0][1].body)).channel, "email");
  assert.match(String(calls[0][1].headers["Idempotency-Key"] || ""), /./);
});

test("SDK: test key talks to Notificas with Bearer", async () => {
  const calls: Array<[string, { headers: Record<string, string> }]> = [];
  const fetchImpl = async (url: string, init: { headers: Record<string, string> }) => {
    calls.push([url, init]);
    return jsonResponse(200, { account: { environment: "test" } });
  };
  const { sdk } = loadSdk({ fetchImpl: fetchImpl as never });
  const client = sdk.create({
    apiKey: "ntf_test_abc",
    baseUrl: "https://notificas.com.ar",
  });
  await client.me();
  assert.equal(calls[0][0], "https://notificas.com.ar/api/v1/me");
  assert.equal(calls[0][1].headers.Authorization, "Bearer ntf_test_abc");
});

test("SDK: propagates API errors", async () => {
  const fetchImpl = async () =>
    jsonResponse(401, { error: { code: "unauthorized", message: "API key inválida." } });
  const { sdk } = loadSdk({ fetchImpl: fetchImpl as never });
  const client = sdk.create({ proxyUrl: "/api/notificas" });
  await assert.rejects(client.me(), (err: unknown) => {
    const e = err as { code?: string; status?: number };
    return e.code === "unauthorized" && e.status === 401;
  });
});
