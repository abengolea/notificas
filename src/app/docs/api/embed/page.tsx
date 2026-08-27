"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LandingHeader } from "@/components/landing-header";

const SNIPPET = `<div
  data-notificas-embed
  data-proxy-url="/api/notificas"
  data-channel="whatsapp"
  data-template="notificacion_deuda_180_dias"
  data-button-label="Enviar notificación certificada"
></div>
<script src="https://notificas.com.ar/sdk/v1/notificas.js" async></script>`;

const JS_SNIPPET = `const client = Notificas.create({
  proxyUrl: "/api/notificas",
});

const { id, status } = await client.sendCertifiedNotification({
  channel: "whatsapp",
  recipient: { name: "Ana Pérez", phone: "+5491112345678" },
  template: "notificacion_deuda_180_dias",
  variables: { nombre: "Ana Pérez", monto: "128400" },
  reference: "CLIENTE-12345",
});`;

export default function EmbedApiPage() {
  const [copied, setCopied] = useState<"html" | "js" | null>(null);
  const [sdkReady, setSdkReady] = useState(false);

  useEffect(() => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-notificas-sdk="v1"]'
    );
    if (existing) {
      setSdkReady(true);
      return;
    }
    const script = document.createElement("script");
    script.src = "/sdk/v1/notificas.js";
    script.async = true;
    script.dataset.notificasSdk = "v1";
    script.onload = () => setSdkReady(true);
    document.body.appendChild(script);
  }, []);

  useEffect(() => {
    if (!sdkReady) return;
    const Notificas = (
      window as unknown as {
        Notificas?: { embed: (el: string, opts: Record<string, unknown>) => void };
      }
    ).Notificas;
    if (!Notificas) return;
    const host = document.querySelector("#notificas-live-demo");
    if (!host || host.childElementCount > 0) return;
    Notificas.embed("#notificas-live-demo", {
      demo: true,
      channel: "whatsapp",
      template: "notificacion_deuda_180_dias",
      buttonLabel: "Enviar (demo)",
    });
  }, [sdkReady]);

  const copy = async (which: "html" | "js") => {
    const text = which === "html" ? SNIPPET : JS_SNIPPET;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        throw new Error("clipboard unavailable");
      }
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "true");
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(which);
    window.setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="brand-canvas flex min-h-screen flex-col text-foreground">
      <LandingHeader />
      <main className="container max-w-3xl flex-1 px-4 py-12 sm:py-16">
        <nav className="mb-6 text-sm text-muted-foreground">
          <Link href="/" className="text-primary underline-offset-4 hover:underline">
            Inicio
          </Link>
          <span aria-hidden> / </span>
          <Link href="/docs/api" className="text-primary underline-offset-4 hover:underline">
            API
          </Link>
          <span aria-hidden> / </span>
          <span className="text-foreground">Insertar en tu web</span>
        </nav>

        <p className="text-sm font-medium text-primary">SDK web v1</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
          Insertá Notificas en tu web
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
          Un script, un widget o un cliente JavaScript. El sitio dispara la
          notificación; Notificas deja constancia del envío. La clave{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-sm">ntf_live_</code>{" "}
          nunca va en el navegador: el widget habla con tu backend, y tu backend
          habla con la API.
        </p>

        <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm leading-relaxed text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          La constancia es evidencia técnica del envío (contenido, destinatario,
          canal y sello). No es firma digital, acto notarial ni carta documento.
        </div>

        <section className="mt-12">
          <h2 className="text-2xl font-semibold">1. Pegá esto</h2>
          <p className="mt-2 text-muted-foreground">
            En cualquier HTML. Reemplazá <code>/api/notificas</code> por el proxy
            de tu servidor.
          </p>
          <div className="relative mt-4">
            <pre className="overflow-x-auto rounded-2xl bg-zinc-950 p-5 text-sm leading-relaxed text-zinc-100">
              <code>{SNIPPET}</code>
            </pre>
            <button
              type="button"
              onClick={() => void copy("html")}
              className="absolute right-3 top-3 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/20"
            >
              {copied === "html" ? "Copiado" : "Copiar"}
            </button>
          </div>
        </section>

        <section className="mt-12">
          <h2 className="text-2xl font-semibold">2. Probá el widget</h2>
          <p className="mt-2 text-muted-foreground">
            Demo local: no llama a la API real. En producción usá{" "}
            <code>data-proxy-url</code> apuntando a tu servidor.
          </p>
          <div className="mt-6" id="notificas-live-demo" />
          {!sdkReady ? (
            <p className="mt-4 text-sm text-muted-foreground">Cargando widget…</p>
          ) : null}
        </section>

        <section className="mt-12">
          <h2 className="text-2xl font-semibold">3. Proxy en tu backend</h2>
          <p className="mt-2 text-muted-foreground">
            El navegador no debe ver la API key. Tu servidor recibe el pedido del
            widget, agrega{" "}
            <code>Authorization: Bearer ntf_live_…</code> y reenvía a{" "}
            <code>https://notificas.com.ar/api/v1</code>.
          </p>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-muted-foreground">
            <li>
              Next.js: <code>docs/examples/nextjs-proxy-route.ts</code>
            </li>
            <li>
              Express: <code>docs/examples/express-proxy.js</code>
            </li>
            <li>
              HTML de ejemplo: <code>docs/examples/embed.html</code>
            </li>
          </ul>
        </section>

        <section className="mt-12">
          <h2 className="text-2xl font-semibold">Cliente JavaScript</h2>
          <p className="mt-2 text-muted-foreground">
            Si preferís tu propio formulario, usá el mismo script:
          </p>
          <div className="relative mt-4">
            <pre className="overflow-x-auto rounded-2xl bg-zinc-950 p-5 text-sm leading-relaxed text-zinc-100">
              <code>{JS_SNIPPET}</code>
            </pre>
            <button
              type="button"
              onClick={() => void copy("js")}
              className="absolute right-3 top-3 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/20"
            >
              {copied === "js" ? "Copiado" : "Copiar"}
            </button>
          </div>
        </section>

        <section className="mt-12 space-y-3 text-muted-foreground">
          <h2 className="text-2xl font-semibold text-foreground">Atributos del widget</h2>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <code>data-proxy-url</code> — URL de tu backend (recomendado).
            </li>
            <li>
              <code>data-api-key</code> — solo <code>ntf_test_</code> o con{" "}
              <code>data-allow-browser-key</code> (no usar en producción).
            </li>
            <li>
              <code>data-channel</code> — <code>whatsapp</code> o{" "}
              <code>email</code>.
            </li>
            <li>
              <code>data-template</code> — nombre de plantilla Meta (WhatsApp).
            </li>
            <li>
              <code>data-button-label</code> — texto del botón.
            </li>
            <li>
              <code>data-demo</code> — <code>true</code> para simular el envío.
            </li>
          </ul>
        </section>

        <p className="mt-12 text-sm text-muted-foreground">
          Referencia REST:{" "}
          <Link href="/docs/api" className="text-primary underline">
            /docs/api
          </Link>
          .
        </p>
      </main>
    </div>
  );
}
