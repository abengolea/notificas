import { NextResponse, type NextRequest } from "next/server";

import {
  hostnameFromRequestHeaders,
  isBrazilPublicPath,
  resolveInternationalGate,
} from "@/lib/international-site";

function withHostVary(response: NextResponse) {
  response.headers.append("Vary", "Host");
  response.headers.append("Vary", "X-Forwarded-Host");
  return response;
}

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const locale = isBrazilPublicPath(pathname) ? "pt-BR" : "es-AR";
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-notificas-locale", locale);

  const gate = resolveInternationalGate({
    host: hostnameFromRequestHeaders(request.headers),
    pathname,
    search: request.nextUrl.search,
  });

  if (gate.type === "rewrite") {
    const url = request.nextUrl.clone();
    url.pathname = gate.pathname;
    const response = NextResponse.rewrite(url, {
      request: { headers: requestHeaders },
    });
    response.headers.set("x-notificas-locale", locale);
    return withHostVary(response);
  }

  if (gate.type === "redirect") {
    return withHostVary(NextResponse.redirect(gate.location, gate.status));
  }

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("x-notificas-locale", locale);
  return withHostVary(response);
}

export const config = {
  matcher: [
    "/",
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|js|css|woff2?)$).*)",
  ],
};
