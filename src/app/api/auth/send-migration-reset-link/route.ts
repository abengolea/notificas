import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminAuth } from "@/lib/firebase-admin";
import { createMailDocumentAdmin } from "@/lib/email-server";
import { DEFAULT_CONTACT_FROM_EMAIL, getFirebaseSendEmailUrl } from "@/lib/mail-defaults";
import { getLegacyMigrationStateCode } from "@/lib/legacy-migration-state-server";

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

function escapeHtml(s: string) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeHref(s: string) {
  return String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;");
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

    const auth = getAdminAuth();
    let link: string;
    try {
      link = await auth.generatePasswordResetLink(email, {
        url: continueUrl,
        handleCodeInApp: false,
      });
    } catch (e) {
      console.error("[send-migration-reset-link] generatePasswordResetLink", e);
      return NextResponse.json({ error: "No se pudo generar el enlace." }, { status: 500 });
    }

    const subject = "Notificas — enlace para definir tu contraseña";
    const html = `
<p>Hola,</p>
<p>Podés definir o restablecer tu contraseña en Notificas usando este enlace:</p>
<p><a href="${escapeHref(link)}">Abrir enlace de contraseña</a></p>
<p>Si el botón no funciona, copiá y pegá esta dirección en el navegador:</p>
<pre style="white-space:pre-wrap;word-break:break-all">${escapeHtml(link)}</pre>
<p style="color:#666;font-size:12px">Mensaje automático — no respondas a este correo.</p>
`.trim();
    const text = `Definí tu contraseña en Notificas abriendo este enlace:\n\n${link}\n`;

    const docId = await createMailDocumentAdmin({
      to: email,
      from: DEFAULT_CONTACT_FROM_EMAIL,
      subject,
      html,
      text,
      createdBy: "api:send-migration-reset-link",
      contactRequest: true,
    });

    const fnUrl = getFirebaseSendEmailUrl();
    const cfController = new AbortController();
    const cfTimeout = setTimeout(() => cfController.abort(), 55_000);
    let cfRes: Response;
    try {
      cfRes = await fetch(fnUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ docId }),
        signal: cfController.signal,
      });
    } catch (fetchErr: unknown) {
      const msg =
        fetchErr instanceof Error && fetchErr.name === "AbortError"
          ? "Timeout al enviar correo"
          : fetchErr instanceof Error
            ? fetchErr.message
            : "Error al enviar correo";
      console.error("[send-migration-reset-link] fetch sendEmail", msg);
      return NextResponse.json({ error: "El enlace se generó pero falló el envío por correo." }, { status: 502 });
    } finally {
      clearTimeout(cfTimeout);
    }

    const cfBody = (await cfRes.json().catch(() => ({}))) as { error?: string; success?: boolean };
    if (!cfRes.ok) {
      console.error("[send-migration-reset-link] sendEmail CF", cfRes.status, cfBody);
      return NextResponse.json(
        { error: cfBody.error || "Error al enviar el correo." },
        { status: 502 },
      );
    }

    return NextResponse.json({ success: true, ...cfBody });
  } catch (e) {
    console.error("[send-migration-reset-link]", e);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
