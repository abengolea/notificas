import { NextResponse, type NextRequest } from "next/server";

import {
  hostnameFromRequestHeaders,
  resolveInternationalGate,
} from "@/lib/international-site";

function withHostVary(response: NextResponse) {
  response.headers.append("Vary", "Host");
  return response;
}

export function middleware(request: NextRequest) {
  const gate = resolveInternationalGate({
    host: hostnameFromRequestHeaders(request.headers),
    pathname: request.nextUrl.pathname,
    search: request.nextUrl.search,
  });

  if (gate.type === "rewrite") {
    const url = request.nextUrl.clone();
    url.pathname = gate.pathname;
    return withHostVary(NextResponse.rewrite(url));
  }

  if (gate.type === "redirect") {
    return withHostVary(NextResponse.redirect(gate.location, gate.status));
  }

  return withHostVary(NextResponse.next());
}

export const config = {
  matcher: [
    "/",
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|js|css|woff2?)$).*)",
  ],
};
