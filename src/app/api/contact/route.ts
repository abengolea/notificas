import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sendEmailCfHeaders } from "@/lib/cf-send-auth";
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
  telefono: z.string().trim().max(40).optional().default(""),
  volumenEstimado: z.string().trim().max(80).optional().default(""),
  canal: z
    .union([z.enum(["whatsapp", "email", "ambos"]), z.literal("")])
    .optional()
    .default(""),
  tipoConsulta: z.enum(["general", "cotizacion"]).optional().default("general"),
});

const CANAL_LABEL: Record<"whatsapp" | "email" | "ambos", string> = {
  whatsapp: "WhatsApp",
  email: "Email",
  ambos: "WhatsApp + Email",
};

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

  const {
    nombre,
    compania,
    email,
    mensaje,
    telefono,
    volumenEstimado,
    canal,
    tipoConsulta,
  } = parsed.data;
  const inbox = getContactInboxEmail();
  const isQuote = tipoConsulta === "cotizacion";
  const canalLabel = canal ? CANAL_LABEL[canal] : "";

  const htmlLines = [
    `<p><strong>Tipo:</strong> ${isQuote ? "Solicitud de cotización corporativa" : "Consulta web"}</p>`,
    `<p><strong>Nombre:</strong> ${escapeHtml(nombre)}</p>`,
    `<p><strong>Empresa:</strong> ${escapeHtml(compania || "(no indicada)")}</p>`,
    `<p><strong>Email:</strong> <a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></p>`,
  ];
  if (telefono) {
    htmlLines.push(`<p><strong>Teléfono:</strong> ${escapeHtml(telefono)}</p>`);
  }
  if (volumenEstimado) {
    htmlLines.push(
      `<p><strong>Volumen estimado:</strong> ${escapeHtml(volumenEstimado)}</p>`
    );
  }
  if (canalLabel) {
    htmlLines.push(`<p><strong>Canal:</strong> ${escapeHtml(canalLabel)}</p>`);
  }
  if (mensaje) {
    htmlLines.push(
      `<p><strong>${isQuote ? "Descripción:" : "Mensaje:"}</strong></p><pre style="white-space:pre-wrap;font-family:inherit">${escapeHtml(mensaje)}</pre>`
    );
  }
  htmlLines.push(
    `<p style="color:#666;font-size:12px">Origen: formulario ${
      isQuote ? "cotización corporativa" : "Contáctenos"
    } (${escapeHtml(process.env.NEXT_PUBLIC_APP_URL || "notificas")})</p>`
  );
  const html = htmlLines.join("\n");
  const text = [
    `Tipo: ${isQuote ? "Solicitud de cotización corporativa" : "Consulta web"}`,
    `Nombre: ${nombre}`,
    `Empresa: ${compania || "(no indicada)"}`,
    `Email: ${email}`,
    telefono ? `Teléfono: ${telefono}` : "",
    volumenEstimado ? `Volumen estimado: ${volumenEstimado}` : "",
    canalLabel ? `Canal: ${canalLabel}` : "",
    mensaje ? `\n${isQuote ? "Descripción" : "Mensaje"}:\n${mensaje}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const createdBy = getContactFormCreatedBy();

  try {
    const docId = await createMailDocumentAdmin({
      to: inbox,
      from: DEFAULT_CONTACT_FROM_EMAIL,
      replyTo: email,
      subject: isQuote
        ? `Cotización corporativa — ${nombre}`
        : `Consulta web — ${nombre}`,
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
      headers: sendEmailCfHeaders(),
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
