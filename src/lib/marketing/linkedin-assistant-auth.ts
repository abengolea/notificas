import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { assertAdminSession, getAdminSessionEmail } from "@/lib/assert-admin-session";

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

/** Admin session cookie or Bearer LINKEDIN_ASSISTANT_TOKEN. */
export function assertLinkedInAssistantAuth(request: NextRequest): NextResponse | null {
  const denied = assertAdminSession(request);
  if (!denied) return null;

  const expected = linkedInAssistantToken();
  const provided = bearerFromRequest(request);
  if (expected && provided && tokenEquals(provided, expected)) return null;

  if (!expected && denied.status === 401) {
    return NextResponse.json(
      { error: "Autenticación requerida. Configurá LINKEDIN_ASSISTANT_TOKEN o iniciá sesión admin." },
      { status: 401 },
    );
  }
  return denied;
}

export function linkedInAssistantActorId(request: NextRequest): string {
  const email = getAdminSessionEmail(request);
  if (email) return email;
  return "linkedin-assistant-extension";
}

export function linkedInAssistantCorsHeaders(origin?: string | null): HeadersInit {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "86400",
  };
  if (origin?.startsWith("chrome-extension://") || origin?.includes("localhost")) {
    headers["Access-Control-Allow-Origin"] = origin;
  } else if (process.env.NODE_ENV === "development") {
    headers["Access-Control-Allow-Origin"] = "*";
  }
  return headers;
}
