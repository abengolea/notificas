import { NextRequest, NextResponse } from "next/server";

/**
 * Enlace público bajo el dominio de la app (p. ej. notificas.com.ar/linkRedirect).
 * Reenvía la petición al servicio Cloud Run que registra el click y redirige al reader,
 * sin exponer la URL de run.app en el SMS/WhatsApp ni en el primer salto del navegador.
 */
const DEFAULT_INTERNAL =
  "https://linkredirect-ju7n3yysfq-uc.a.run.app";

function internalLinkRedirectOrigin(): string {
  const v = process.env.INTERNAL_LINK_REDIRECT_URL?.trim();
  return v && v.length > 0 ? v.replace(/\/$/, "") : DEFAULT_INTERNAL;
}

export async function GET(request: NextRequest) {
  const qs = request.nextUrl.search;
  const internal = `${internalLinkRedirectOrigin()}${qs}`;

  const ua = request.headers.get("user-agent");
  const xf = request.headers.get("x-forwarded-for");
  const xri = request.headers.get("x-real-ip");

  let upstream: Response;
  try {
    upstream = await fetch(internal, {
      method: "GET",
      redirect: "manual",
      cache: "no-store",
      headers: {
        ...(ua ? { "user-agent": ua } : {}),
        ...(xf ? { "x-forwarded-for": xf } : {}),
        ...(xri ? { "x-real-ip": xri } : {}),
      },
    });
  } catch {
    return new NextResponse("Bad gateway", { status: 502 });
  }

  if (upstream.status >= 300 && upstream.status < 400) {
    const loc = upstream.headers.get("location");
    if (loc) {
      return NextResponse.redirect(loc, upstream.status);
    }
  }

  if (upstream.status === 400) {
    const t = await upstream.text();
    return new NextResponse(t || "Missing params", { status: 400 });
  }

  return new NextResponse("Bad gateway", { status: 502 });
}
