import { NextResponse, type NextRequest } from "next/server";

import { resolveInternationalGate } from "@/lib/international-site";

export function middleware(request: NextRequest) {
  const gate = resolveInternationalGate({
    host: request.headers.get("host") ?? "",
    pathname: request.nextUrl.pathname,
    search: request.nextUrl.search,
  });

  if (gate.type === "rewrite") {
    const url = request.nextUrl.clone();
    url.pathname = gate.pathname;
    return NextResponse.rewrite(url);
  }

  if (gate.type === "redirect") {
    return NextResponse.redirect(gate.location, 308);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|js|css|woff2?)$).*)",
  ],
};
