import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { assertAdminSession, getAdminSessionEmail } from "@/lib/assert-admin-session";
import {
  EXTENSION_ACCESS_TYP,
  getExtensionSigningSecret,
  verifyExtensionToken,
} from "./linkedin-assistant-tokens";

const SESSION_EXPIRED_BODY = {
  error: "session_expired",
  message: "Tu sesión venció. Volvé a iniciar sesión.",
};

function tokenEquals(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) {
    const dummy = Buffer.alloc(b.length);
    timingSafeEqual(dummy, b);
    return false;
  }
  return timingSafeEqual(a, b);
}

export function linkedInAssistantToken(): string | null {
  const token = process.env.LINKEDIN_ASSISTANT_TOKEN?.trim();
  return token || null;
}

export function bearerFromRequest(request: NextRequest): string | null {
  const header = request.headers.get("Authorization")?.trim();
  if (!header?.toLowerCase().startsWith("bearer ")) return null;
  return header.slice(7).trim() || null;
}

function acceptDevStaticToken(): boolean {
  return process.env.NODE_ENV !== "production";
}

function sessionExpiredResponse(): NextResponse {
  return NextResponse.json(SESSION_EXPIRED_BODY, { status: 401 });
}

function unauthorizedResponse(message = "Tu sesión venció. Volvé a iniciar sesión."): NextResponse {
  return NextResponse.json({ error: "session_expired", message }, { status: 401 });
}

/** Admin cookie, signed extension access token, or (dev only) static env token. */
export function assertLinkedInAssistantAuth(request: NextRequest): NextResponse | null {
  const denied = assertAdminSession(request);
  if (!denied) return null;

  const provided = bearerFromRequest(request);
  if (provided) {
    const secret = getExtensionSigningSecret();
    if (secret) {
      const verified = verifyExtensionToken(provided, secret, EXTENSION_ACCESS_TYP);
      if (verified.ok) return null;
      if (verified.reason === "expired") return sessionExpiredResponse();
    }

    if (acceptDevStaticToken()) {
      const expected = linkedInAssistantToken();
      if (expected && tokenEquals(provided, expected)) return null;
    }
  }

  if (!provided) {
    return unauthorizedResponse();
  }

  if (denied.status === 503 && !getExtensionSigningSecret() && !linkedInAssistantToken()) {
    return NextResponse.json(
      {
        error: "auth_not_configured",
        message: "El servidor no tiene autenticación de extensión configurada.",
      },
      { status: 503 },
    );
  }

  return unauthorizedResponse();
}

export function linkedInAssistantActorId(request: NextRequest): string {
  const email = getAdminSessionEmail(request);
  if (email) return email;

  const provided = bearerFromRequest(request);
  const secret = getExtensionSigningSecret();
  if (provided && secret) {
    const verified = verifyExtensionToken(provided, secret, EXTENSION_ACCESS_TYP);
    if (verified.ok) return verified.payload.e;
  }

  return "linkedin-assistant-extension";
}

export function isChromeExtensionOrigin(origin?: string | null): boolean {
  return Boolean(origin?.startsWith("chrome-extension://"));
}

export function isLocalDevOrigin(origin?: string | null): boolean {
  if (!origin) return false;
  try {
    const url = new URL(origin);
    return url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]";
  } catch {
    return false;
  }
}

export function linkedInAssistantCorsHeaders(origin?: string | null): HeadersInit {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };

  if (isChromeExtensionOrigin(origin)) {
    headers["Access-Control-Allow-Origin"] = origin as string;
    return headers;
  }

  if (process.env.NODE_ENV !== "production" && isLocalDevOrigin(origin)) {
    headers["Access-Control-Allow-Origin"] = origin as string;
  }

  return headers;
}
