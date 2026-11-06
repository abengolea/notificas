/**
 * Proxy hacia la API pública de Notificas.
 * El navegador nunca ve NOTIFICAS_API_KEY. Requiere cookie de sesión
 * abierta por /api/notificas/session (super admin).
 */
import { NextRequest, NextResponse } from "next/server";
import {
  notificasApiBase,
  notificasApiConfigured,
  notificasEmbedCookie,
  verifyNotificasEmbedSession,
} from "@/lib/notificas-embed";

const ALLOWED_PREFIXES = ["notifications", "me"];

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
  const session = await verifyNotificasEmbedSession(
    request.cookies.get(notificasEmbedCookie.name)?.value
  );
  if (!session) {
    return NextResponse.json(
      {
        error: {
          code: "unauthorized",
          message: "Sesión de Notificas vencida. Recargá la página.",
        },
      },
      { status: 401 }
    );
  }

  if (!notificasApiConfigured()) {
    return NextResponse.json(
      {
        error: {
          code: "misconfigured",
          message: "Falta NOTIFICAS_API_KEY en .env.local de gestión-regatas.",
        },
      },
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
  const target = `${notificasApiBase()}/${segments.map(encodeURIComponent).join("/")}${search}`;
  const headers = new Headers();
  headers.set("Authorization", `Bearer ${process.env.NOTIFICAS_API_KEY!.trim()}`);
  headers.set("Accept", "application/json");
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("Content-Type", contentType);
  const idempotency = request.headers.get("Idempotency-Key");
  if (idempotency) headers.set("Idempotency-Key", idempotency);

  const init: RequestInit = { method: request.method, headers };
  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = await request.text();
  }

  try {
    const upstream = await fetch(target, init);
    const body = await upstream.text();
    return new NextResponse(body, {
      status: upstream.status,
      headers: {
        "Content-Type": upstream.headers.get("content-type") ?? "application/json",
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "No se pudo contactar Notificas.";
    return NextResponse.json(
      { error: { code: "upstream_unreachable", message } },
      { status: 502 }
    );
  }
}
