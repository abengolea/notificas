/**
 * Proxy Next.js App Router: el navegador llama a /api/notificas/*
 * y este handler reenvía a la API pública de Notificas con la clave
 * de servidor (nunca expuesta al frontend).
 *
 * Guardá este archivo en tu proyecto como:
 *   app/api/notificas/[...path]/route.ts
 *
 * Env:
 *   NOTIFICAS_API_KEY=ntf_live_...
 *   NOTIFICAS_API_BASE=https://notificas.com.ar/api/v1
 */
import { NextRequest, NextResponse } from "next/server";

const ALLOWED_PREFIXES = [
  "notifications",
  "batches",
  "me",
  "webhook-endpoints",
];

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  return proxy(request, context);
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  return proxy(request, context);
}

async function proxy(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const apiKey = process.env.NOTIFICAS_API_KEY;
  const base = (process.env.NOTIFICAS_API_BASE ?? "https://notificas.com.ar/api/v1").replace(
    /\/$/,
    ""
  );
  if (!apiKey) {
    return NextResponse.json(
      { error: { code: "misconfigured", message: "Falta NOTIFICAS_API_KEY." } },
      { status: 500 }
    );
  }

  const { path } = await context.params;
  const segments = path ?? [];
  const first = segments[0] ?? "";
  if (!ALLOWED_PREFIXES.includes(first)) {
    return NextResponse.json(
      { error: { code: "forbidden_path", message: "Ruta no permitida." } },
      { status: 403 }
    );
  }

  const search = request.nextUrl.search;
  const target = `${base}/${segments.map(encodeURIComponent).join("/")}${search}`;
  const headers = new Headers();
  headers.set("Authorization", `Bearer ${apiKey}`);
  headers.set("Accept", "application/json");
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("Content-Type", contentType);
  const idempotency = request.headers.get("Idempotency-Key");
  if (idempotency) headers.set("Idempotency-Key", idempotency);

  const init: RequestInit = { method: request.method, headers };
  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = await request.text();
  }

  const upstream = await fetch(target, init);
  const body = await upstream.text();
  return new NextResponse(body, {
    status: upstream.status,
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "application/json",
    },
  });
}
