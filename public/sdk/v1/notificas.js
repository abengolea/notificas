/**
 * Notificas Web SDK v1 — instrumento para insertar la API en sitios.
 *
 * <script src="https://notificas.com.ar/sdk/v1/notificas.js"></script>
 *
 * Uso recomendado en webs públicas: proxyUrl (la API Key queda en tu servidor).
 * No pongas ntf_live_… en HTML público.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (typeof root === "object" && root) {
    root.Notificas = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var VERSION = "1.0.0";
  var DEFAULT_BASE = "https://notificas.com.ar";
  var STYLE_ID = "notificas-embed-css";

  function isBrowser() {
    return typeof window !== "undefined" && typeof document !== "undefined";
  }

  function trimSlash(url) {
    return String(url || "").replace(/\/+$/, "");
  }

  function randomIdempotencyKey() {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
    return "web_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 10);
  }

  function isLiveKey(key) {
    return String(key || "").trim().indexOf("ntf_live_") === 0;
  }

  function assertBrowserKeySafe(opts) {
    var apiKey = opts && opts.apiKey;
    var proxyUrl = opts && opts.proxyUrl;
    var allow = opts && opts.allowBrowserKey === true;
    if (proxyUrl) return;
    if (!apiKey) {
      throw new Error("Notificas: definí proxyUrl (recomendado) o apiKey.");
    }
    if (isBrowser() && isLiveKey(apiKey) && !allow) {
      throw new Error(
        "Notificas: no uses una clave ntf_live_ en el navegador. Configurá proxyUrl hacia tu backend."
      );
    }
  }

  function requestHeaders(opts, extra) {
    var headers = { "Content-Type": "application/json", Accept: "application/json" };
    if (opts.apiKey && !opts.proxyUrl) headers.Authorization = "Bearer " + opts.apiKey;
    if (opts.requestId) headers["X-Request-Id"] = opts.requestId;
    if (extra) {
      for (var k in extra) if (Object.prototype.hasOwnProperty.call(extra, k) && extra[k]) headers[k] = extra[k];
    }
    return headers;
  }

  function stripApiV1(path) {
    var p = String(path || "");
    if (p.indexOf("/api/v1/") === 0) return p.slice("/api/v1".length);
    if (p === "/api/v1") return "";
    return p;
  }

  function resolveUrl(opts, path) {
    if (opts.proxyUrl) {
      var proxy = trimSlash(opts.proxyUrl);
      if (opts.proxyMapsFullPath) return proxy + path;
      return proxy + stripApiV1(path);
    }
    return trimSlash(opts.baseUrl || DEFAULT_BASE) + path;
  }

  function parseError(status, body, requestId) {
    var errBody = body && body.error ? body.error : {};
    var error = new Error(errBody.message || "HTTP " + status);
    error.name = "NotificasApiError";
    error.status = status;
    error.type = errBody.type || "api_error";
    error.code = errBody.code || "http_error";
    error.requestId = errBody.request_id || requestId || null;
    error.param = errBody.param;
    return error;
  }

  function createClient(options) {
    var opts = options || {};
    assertBrowserKeySafe(opts);
    if (!opts.baseUrl) opts.baseUrl = DEFAULT_BASE;

    function request(method, path, body, extraHeaders) {
      var url = resolveUrl(opts, path);
      var init = { method: method, headers: requestHeaders(opts, extraHeaders) };
      if (body !== undefined && body !== null && method !== "GET") init.body = JSON.stringify(body);
      return fetch(url, init).then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (json) {
          var requestId =
            res.headers && typeof res.headers.get === "function"
              ? res.headers.get("X-Request-Id")
              : null;
          if (!res.ok) throw parseError(res.status, json, requestId);
          return json;
        });
      });
    }

    return {
      version: VERSION,
      sendCertifiedNotification: function (input) {
        var payload = input || {};
        var idem = payload.idempotencyKey || randomIdempotencyKey();
        var body = {
          channel: payload.channel,
          recipient: payload.recipient,
          template: payload.template,
          variables: payload.variables,
          subject: payload.subject,
          body: payload.body,
          reference: payload.reference,
          metadata: payload.metadata,
        };
        return request("POST", "/api/v1/notifications", body, { "Idempotency-Key": idem });
      },
      getNotification: function (id) {
        return request("GET", "/api/v1/notifications/" + encodeURIComponent(id));
      },
      getCertificate: function (id) {
        return request("GET", "/api/v1/notifications/" + encodeURIComponent(id) + "/certificate");
      },
      listNotifications: function (query) {
        var q = query || {};
        var params = new URLSearchParams();
        Object.keys(q).forEach(function (k) {
          if (q[k] != null && q[k] !== "") params.set(k, String(q[k]));
        });
        var qs = params.toString();
        return request("GET", "/api/v1/notifications" + (qs ? "?" + qs : ""));
      },
      me: function () {
        return request("GET", "/api/v1/me");
      },
    };
  }

  function css() {
    return [
      ".ntf-embed{all:initial;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#0f172a;display:block;max-width:440px;}",
      ".ntf-embed *{box-sizing:border-box;font-family:inherit;}",
      ".ntf-card{border:1px solid #d7e0e2;border-radius:12px;background:#fff;padding:20px 20px 16px;box-shadow:0 8px 24px rgba(15,23,42,.06);}",
      ".ntf-brand{display:flex;align-items:center;gap:8px;margin-bottom:4px;}",
      ".ntf-mark{width:28px;height:28px;border-radius:8px;background:#0D9488;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:14px;}",
      ".ntf-title{font-size:16px;font-weight:700;margin:0;}",
      ".ntf-sub{font-size:12px;color:#64748b;margin:0 0 14px;line-height:1.45;}",
      ".ntf-row{display:flex;gap:8px;}",
      ".ntf-field{display:flex;flex-direction:column;gap:4px;margin-bottom:10px;flex:1;}",
      ".ntf-field label{font-size:12px;font-weight:600;color:#334155;}",
      ".ntf-field input,.ntf-field select,.ntf-field textarea{width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:14px;background:#fff;color:#0f172a;}",
      ".ntf-field textarea{min-height:64px;resize:vertical;}",
      ".ntf-field input:focus,.ntf-field select:focus,.ntf-field textarea:focus{outline:2px solid #99f6e4;border-color:#0D9488;}",
      ".ntf-btn{width:100%;border:0;border-radius:8px;background:#0D9488;color:#fff;font-weight:700;font-size:14px;padding:10px 12px;cursor:pointer;}",
      ".ntf-btn:disabled{opacity:.6;cursor:not-allowed;}",
      ".ntf-btn:hover:not(:disabled){background:#0f766e;}",
      ".ntf-msg{margin-top:10px;font-size:13px;line-height:1.4;border-radius:8px;padding:8px 10px;}",
      ".ntf-ok{background:#ecfdf5;color:#065f46;}",
      ".ntf-err{background:#fef2f2;color:#991b1b;}",
      ".ntf-foot{margin-top:10px;font-size:11px;color:#94a3b8;}",
      ".ntf-foot a{color:#0D9488;text-decoration:none;}",
    ].join("");
  }

  function ensureStyle() {
    if (!isBrowser() || document.getElementById(STYLE_ID)) return;
    var el = document.createElement("style");
    el.id = STYLE_ID;
    el.textContent = css();
    document.head.appendChild(el);
  }

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === "className") node.className = attrs[k];
        else if (k === "text") node.textContent = attrs[k];
        else if (k.indexOf("on") === 0 && typeof attrs[k] === "function") node.addEventListener(k.slice(2).toLowerCase(), attrs[k]);
        else if (attrs[k] != null) node.setAttribute(k, String(attrs[k]));
      });
    }
    (children || []).forEach(function (c) {
      if (c) node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return node;
  }

  function field(label, input) {
    return el("div", { className: "ntf-field" }, [el("label", { text: label }), input]);
  }

  function parseVariables(raw) {
    var t = String(raw || "").trim();
    if (!t) return {};
    if (t.charAt(0) === "{") {
      var json = JSON.parse(t);
      if (!json || typeof json !== "object" || Array.isArray(json)) throw new Error("variables inválidas");
      return json;
    }
    var out = {};
    t.split(/[\n,]/).forEach(function (line) {
      var i = line.indexOf("=");
      if (i < 1) return;
      out[line.slice(0, i).trim()] = line.slice(i + 1).trim();
    });
    return out;
  }

  function embed(target, options) {
    if (!isBrowser()) throw new Error("Notificas.embed solo funciona en el navegador.");
    ensureStyle();
    var opts = options || {};
    var mount = typeof target === "string" ? document.querySelector(target) : target;
    if (!mount) throw new Error("Notificas.embed: no se encontró el contenedor.");

    var client = null;
    if (!opts.demo) client = createClient(opts);

    mount.innerHTML = "";
    var root = el("div", { className: "ntf-embed" });
    var channel = el("select", null, [
      el("option", { value: "whatsapp", text: "WhatsApp" }),
      el("option", { value: "email", text: "Email" }),
    ]);
    channel.value = opts.channel === "email" ? "email" : "whatsapp";
    var name = el("input", { type: "text", autocomplete: "name", maxlength: "120" });
    var phone = el("input", { type: "tel", autocomplete: "tel", placeholder: "+54911…" });
    var email = el("input", { type: "email", autocomplete: "email", placeholder: "correo@dominio.com" });
    var documentId = el("input", { type: "text", maxlength: "20", placeholder: "DNI / CUIT" });
    var template = el("input", { type: "text", maxlength: "128", placeholder: "notificacion_deuda_180_dias" });
    if (opts.template) template.value = opts.template;
    var reference = el("input", { type: "text", maxlength: "128", placeholder: "CLIENTE-12345" });
    var variables = el("textarea", {
      placeholder: "nombre=Juan Pérez\ndni=20123456\nmonto=125000",
    });
    if (opts.variables && typeof opts.variables === "object") {
      variables.value = Object.keys(opts.variables)
        .map(function (k) { return k + "=" + opts.variables[k]; })
        .join("\n");
    }
    var subject = el("input", { type: "text", maxlength: "300", placeholder: "Asunto del correo" });
    var body = el("textarea", { placeholder: "Texto del mensaje (email)" });
    var status = el("div");
    var buttonLabel = opts.buttonLabel || "Enviar notificación";
    var btn = el("button", { className: "ntf-btn", type: "button", text: buttonLabel });

    function setMsg(ok, text) {
      status.className = "ntf-msg " + (ok ? "ntf-ok" : "ntf-err");
      status.textContent = text;
    }

    function syncChannel() {
      var wa = channel.value === "whatsapp";
      phone.parentElement.style.display = wa || opts.showAllFields ? "" : "none";
      email.parentElement.style.display = !wa || opts.showAllFields ? "" : "none";
      subject.parentElement.style.display = wa ? "none" : "";
      body.parentElement.style.display = wa ? "none" : "";
      template.parentElement.style.display = opts.hideTemplate ? "none" : "";
    }
    channel.addEventListener("change", syncChannel);

    btn.addEventListener("click", function () {
      status.textContent = "";
      status.className = "";
      var vars;
      try {
        vars = parseVariables(variables.value);
      } catch (e) {
        setMsg(false, "Revisá las variables (JSON o clave=valor).");
        return;
      }
      var payload = {
        channel: channel.value,
        recipient: {
          name: name.value.trim() || undefined,
          phone: phone.value.trim() || undefined,
          email: email.value.trim() || undefined,
          document: documentId.value.trim() || undefined,
        },
        template: template.value.trim() || undefined,
        variables: vars,
        reference: reference.value.trim() || undefined,
        subject: subject.value.trim() || undefined,
        body: body.value.trim() || undefined,
        metadata: opts.metadata,
      };
      if (opts.demo) {
        setMsg(true, "Modo demostración: no se envió nada. En producción usá proxyUrl o una clave de test.");
        if (typeof opts.onSent === "function") opts.onSent({ id: "ntf_demo", status: "queued", test_mode: true, demo: true });
        return;
      }
      btn.disabled = true;
      btn.textContent = "Enviando…";
      client
        .sendCertifiedNotification(payload)
        .then(function (res) {
          var id = res && res.id ? res.id : "";
          var st = res && res.status ? res.status : "queued";
          setMsg(true, "Enviada. ID " + id + " · estado " + st + ". Queda constancia técnica de qué se envió, a quién y cuándo.");
          if (typeof opts.onSent === "function") opts.onSent(res);
        })
        .catch(function (err) {
          setMsg(false, (err && err.message) || "No se pudo enviar.");
          if (typeof opts.onError === "function") opts.onError(err);
        })
        .then(function () {
          btn.disabled = false;
          btn.textContent = buttonLabel;
        });
    });

    root.appendChild(
      el("div", { className: "ntf-card" }, [
        el("div", { className: "ntf-brand" }, [
          el("div", { className: "ntf-mark", text: "N" }),
          el("p", { className: "ntf-title", text: opts.title || "Notificación certificada" }),
        ]),
        el("p", {
          className: "ntf-sub",
          text:
            opts.subtitle ||
            "Envía un mensaje y deja constancia de qué salió, a quién y cuándo. No reemplaza una carta documento si la norma pide esa forma.",
        }),
        field("Canal", channel),
        field("Nombre", name),
        field("Teléfono (WhatsApp)", phone),
        field("Email", email),
        field("Documento", documentId),
        field("Plantilla", template),
        field("Referencia", reference),
        field("Variables (clave=valor)", variables),
        field("Asunto", subject),
        field("Cuerpo", body),
        btn,
        status,
        el("p", { className: "ntf-foot" }, [
          document.createTextNode("Instrumento "),
          el("a", { href: "https://notificas.com.ar", text: "Notificas" }),
        ]),
      ])
    );
    mount.appendChild(root);
    syncChannel();
    return {
      destroy: function () {
        mount.innerHTML = "";
      },
      client: client,
    };
  }

  function autoEmbed() {
    if (!isBrowser()) return;
    var nodes = document.querySelectorAll("[data-notificas-embed]");
    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      if (node.getAttribute("data-notificas-ready") === "1") continue;
      var varsRaw = node.getAttribute("data-variables");
      var variables;
      try {
        variables = varsRaw ? JSON.parse(varsRaw) : undefined;
      } catch (e) {
        variables = undefined;
      }
      embed(node, {
        proxyUrl: node.getAttribute("data-proxy-url") || undefined,
        apiKey: node.getAttribute("data-api-key") || undefined,
        allowBrowserKey: node.getAttribute("data-allow-browser-key") === "true",
        baseUrl: node.getAttribute("data-base-url") || undefined,
        channel: node.getAttribute("data-channel") || undefined,
        template: node.getAttribute("data-template") || undefined,
        title: node.getAttribute("data-title") || undefined,
        demo: node.getAttribute("data-demo") === "true",
        hideTemplate: node.getAttribute("data-hide-template") === "true",
        buttonLabel: node.getAttribute("data-button-label") || undefined,
        variables: variables,
      });
      node.setAttribute("data-notificas-ready", "1");
    }
  }

  if (isBrowser()) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", autoEmbed);
    } else {
      autoEmbed();
    }
  }

  return {
    version: VERSION,
    create: createClient,
    embed: embed,
    autoEmbed: autoEmbed,
    _assertBrowserKeySafe: assertBrowserKeySafe,
    _parseVariables: parseVariables,
    _resolveUrl: resolveUrl,
    _isLiveKey: isLiveKey,
  };
});
