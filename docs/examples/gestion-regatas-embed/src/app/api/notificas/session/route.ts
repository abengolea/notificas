/**
 * Abre una sesión corta (cookie httpOnly) para que el widget de Notificas
 * pueda hablar con el proxy sin exponer la API key ni el token de Firebase.
 * Solo super admin.
 */
import { NextResponse } from "next/server";
import { verifySuperAdmin } from "@/lib/auth-server";
import {
  notificasApiConfigured,
  notificasEmbedCookie,
  signNotificasEmbedSession,
} from "@/lib/notificas-embed";

export async function GET(request: Request) {
  const admin = await verifySuperAdmin(request.headers.get("Authorization"));
  if (!admin) {
    return NextResponse.json({ error: { message: "No autorizado" } }, { status: 401 });
  }
  return NextResponse.json({ ok: true, configured: notificasApiConfigured() });
}

export async function POST(request: Request) {
  const admin = await verifySuperAdmin(request.headers.get("Authorization"));
  if (!admin) {
    return NextResponse.json({ error: { message: "No autorizado" } }, { status: 401 });
  }

  const token = await signNotificasEmbedSession(admin.uid);
  const res = NextResponse.json({ ok: true, configured: notificasApiConfigured() });
  res.cookies.set(notificasEmbedCookie.name, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: notificasEmbedCookie.maxAge,
    secure: process.env.NODE_ENV === "production",
  });
  return res;
}
