import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getLegacyMigrationStateCode } from "@/lib/legacy-migration-state-server";
import { sendPasswordLinkEmail } from "@/lib/send-account-setup-email";

const bodySchema = z.object({
  email: z.string().email(),
});

function normalizeEmail(raw: string) {
  return raw.trim().toLowerCase();
}

/** Origen del navegador (cabecera Origin): localhost o el mismo host que NEXT_PUBLIC_APP_URL. */
function isTrustedRequestOrigin(originHeader: string): boolean {
  let u: URL;
  try {
    u = new URL(originHeader);
  } catch {
    return false;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return false;
  if (u.pathname !== "/" && u.pathname !== "") return false;

  const host = u.hostname.toLowerCase();
  if (host === "localhost" || host === "127.0.0.1") return true;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (appUrl) {
    try {
      const app = new URL(appUrl);
      const appHost = app.hostname.toLowerCase();
      const stripWww = (h: string) => (h.startsWith("www.") ? h.slice(4) : h);
      if (stripWww(host) === stripWww(appHost)) return true;
    } catch {
      /* ignore */
    }
  }
  return false;
}

export async function POST(request: NextRequest) {
  try {
    const json = await request.json().catch(() => null);
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
    }
    const email = normalizeEmail(parsed.data.email);

    const originHeader = request.headers.get("origin");
    if (!originHeader) {
      return NextResponse.json(
        { error: "No se pudo determinar el origen del pedido. Abrí esta página en el navegador e intentá de nuevo." },
        { status: 400 },
      );
    }
    if (!isTrustedRequestOrigin(originHeader)) {
      return NextResponse.json(
        {
          error:
            "Este dominio no está permitido para enviar el enlace. Revisá NEXT_PUBLIC_APP_URL o usá localhost en desarrollo.",
        },
        { status: 400 },
      );
    }
    const continueUrl = `${originHeader.replace(/\/$/, "")}/login`;

    const state = await getLegacyMigrationStateCode(email);
    if (!state.ok) {
      if (state.reason === "auth_user_not_found") {
        return NextResponse.json(
          { error: "No hay una cuenta con ese correo en este sistema." },
          { status: 404 },
        );
      }
      console.error("[send-migration-reset-link] auth", state.cause);
      return NextResponse.json({ error: "No se pudo verificar el correo." }, { status: 500 });
    }

    const mailResult = await sendPasswordLinkEmail({
      kind: "migration",
      email,
      continueUrl,
      createdBy: "api:send-migration-reset-link",
    });
    if (!mailResult.ok) {
      console.error("[send-migration-reset-link] sendPasswordLinkEmail", mailResult.error);
      return NextResponse.json(
        { error: mailResult.error || "Error al enviar el correo." },
        { status: mailResult.status || 502 },
      );
    }

    return NextResponse.json({ success: true, mailDocId: mailResult.mailDocId });
  } catch (e) {
    console.error("[send-migration-reset-link]", e);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
