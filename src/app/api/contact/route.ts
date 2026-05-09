import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createMailDocumentAdmin } from "@/lib/email-server";
import {
  DEFAULT_CONTACT_FROM_EMAIL,
  getContactFormCreatedBy,
  getContactInboxEmail,
  getFirebaseSendEmailUrl,
} from "@/lib/mail-defaults";

const bodySchema = z.object({
  nombre: z.string().trim().min(1).max(200),
  compania: z.string().trim().max(200).optional().default(""),
  email: z.string().trim().email().max(320),
  mensaje: z.string().trim().max(8000).optional().default(""),
});

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function POST(request: NextRequest) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Revisá nombre y email." }, { status: 400 });
  }

  const { nombre, compania, email, mensaje } = parsed.data;
  const inbox = getContactInboxEmail();

  const htmlLines = [
    `<p><strong>Nombre:</strong> ${escapeHtml(nombre)}</p>`,
    `<p><strong>Compañía:</strong> ${escapeHtml(compania || "(no indicada)")}</p>`,
    `<p><strong>Email:</strong> <a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></p>`,
  ];
  if (mensaje) {
    htmlLines.push(
      `<p><strong>Mensaje:</strong></p><pre style="white-space:pre-wrap;font-family:inherit">${escapeHtml(mensaje)}</pre>`
    );
  }
  htmlLines.push(
    `<p style="color:#666;font-size:12px">Origen: formulario Contáctenos (${escapeHtml(
      process.env.NEXT_PUBLIC_APP_URL || "notificas"
    )})</p>`
  );
  const html = htmlLines.join("\n");
  const text = [
    `Nombre: ${nombre}`,
    `Compañía: ${compania || "(no indicada)"}`,
    `Email: ${email}`,
    mensaje ? `\nMensaje:\n${mensaje}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const createdBy = getContactFormCreatedBy();

  try {
    const docId = await createMailDocumentAdmin({
      to: inbox,
      from: DEFAULT_CONTACT_FROM_EMAIL,
      replyTo: email,
      subject: `Consulta web — ${nombre}`,
      html,
      text,
      senderName: nombre,
      recipientName: nombre,
      recipientEmail: email,
      createdBy,
      contactRequest: true,
    });

    const fnUrl = getFirebaseSendEmailUrl();
    const cfRes = await fetch(fnUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ docId }),
    });

    const cfBody = (await cfRes.json().catch(() => ({}))) as {
      error?: string;
      success?: boolean;
    };

    if (!cfRes.ok) {
      console.error("sendEmail function:", cfRes.status, cfBody);
      return NextResponse.json(
        {
          error:
            cfBody.error ||
            "No se pudo enviar el mensaje. Intentá más tarde o escribinos por correo.",
        },
        { status: 502 }
      );
    }

    return NextResponse.json({ ok: true as const, docId });
  } catch (e) {
    console.error("POST /api/contact:", e);
    return NextResponse.json(
      { error: "Error al procesar el envío. Intentá más tarde." },
      { status: 500 }
    );
  }
}
