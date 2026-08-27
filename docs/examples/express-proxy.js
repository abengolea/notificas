/**
 * Proxy Express: el navegador llama a /api/notificas/*
 * y este middleware reenvía a https://notificas.com.ar/api/v1
 * con la API key de servidor.
 *
 *   npm i express
 *   NOTIFICAS_API_KEY=ntf_live_... node docs/examples/express-proxy.js
 */
const express = require("express");

const app = express();
app.use(express.json({ limit: "1mb" }));

const API_KEY = process.env.NOTIFICAS_API_KEY;
const BASE = (process.env.NOTIFICAS_API_BASE || "https://notificas.com.ar/api/v1").replace(
  /\/$/,
  ""
);
const ALLOWED = new Set(["notifications", "batches", "me", "webhook-endpoints"]);

app.use("/api/notificas", async (req, res) => {
  if (!API_KEY) {
    return res.status(500).json({
      error: { code: "misconfigured", message: "Falta NOTIFICAS_API_KEY." },
    });
  }
  const suffix = (req.path || "/").replace(/^\//, "");
  const first = suffix.split("/")[0];
  if (!ALLOWED.has(first)) {
    return res.status(403).json({
      error: { code: "forbidden_path", message: "Ruta no permitida." },
    });
  }

  const url = new URL(`${BASE}/${suffix}`);
  for (const [key, value] of Object.entries(req.query)) {
    if (typeof value === "string") url.searchParams.set(key, value);
  }

  const headers = {
    Authorization: `Bearer ${API_KEY}`,
    Accept: "application/json",
  };
  if (req.headers["content-type"]) {
    headers["Content-Type"] = req.headers["content-type"];
  }
  if (req.headers["idempotency-key"]) {
    headers["Idempotency-Key"] = req.headers["idempotency-key"];
  }

  const init = { method: req.method, headers };
  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = JSON.stringify(req.body ?? {});
  }

  const upstream = await fetch(url, init);
  const text = await upstream.text();
  res.status(upstream.status);
  res.set("Content-Type", upstream.headers.get("content-type") || "application/json");
  return res.send(text);
});

if (require.main === module) {
  const port = Number(process.env.PORT || 8787);
  app.listen(port, () => {
    console.log(`Notificas proxy en http://localhost:${port}/api/notificas`);
  });
}

module.exports = app;
