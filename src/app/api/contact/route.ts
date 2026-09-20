import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sendEmailCfHeaders } from "@/lib/cf-send-auth";
import { countryName } from "@/lib/marketing/countries";
import { createMailDocumentAdmin } from "@/lib/email-server";
import {
  DEFAULT_CONTACT_FROM_EMAIL,
  getContactFormCreatedBy,
  getContactInboxEmail,
  getFirebaseSendEmailUrl,
} from "@/lib/mail-defaults";

const finalidadeSchema = z.enum([
  "cobranca",
  "pre-negativacao",
  "notificacao-contratual",
  "juridico",
  "credito",
  "outros",
]);

const tipoOrganizacionSchema = z.enum([
  "cobranza",
  "financiera",
  "fintech",
  "cooperativa",
  "aseguradora",
  "retail",
  "servicios",
  "otra",
]);

const bodySchema = z.object({
  nombre: z.string().trim().min(1).max(200),
  apellido: z.string().trim().max(200).optional().default(""),
  compania: z.string().trim().max(200).optional().default(""),
  email: z.string().trim().email().max(320),
  mensaje: z.string().trim().max(8000).optional().default(""),
  telefono: z.string().trim().max(40).optional().default(""),
  volumenEstimado: z.string().trim().max(80).optional().default(""),
  canal: z
    .union([z.enum(["whatsapp", "email", "ambos"]), z.literal("")])
    .optional()
    .default(""),
  tipoConsulta: z
    .enum(["general", "cotizacion", "demostracion"])
    .optional()
    .default("general"),
  mercado: z.enum(["AR", "BR", "CO"]).optional().default("AR"),
  pais: z.string().trim().max(80).optional().default(""),
  cnpj: z.string().trim().max(32).optional().default(""),
  cargo: z.string().trim().max(120).optional().default(""),
  tipoOrganizacion: tipoOrganizacionSchema.optional(),
  finalidade: z.array(finalidadeSchema).max(6).optional().default([]),
  aceptoPrivacidad: z.boolean().optional().default(false),
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
    const mercado =
      json && typeof json === "object" && "mercado" in json
        ? (json as { mercado?: string }).mercado
        : "AR";
    const error =
      mercado === "BR"
        ? "Revise nome e e-mail corporativo."
        : mercado === "CO"
          ? "Revise nombre, apellido y correo electrónico corporativo."
          : "Revisá nombre y email.";
    return NextResponse.json({ error }, { status: 400 });
  }

  const {
    nombre,
    apellido,
    compania,
    email,
    mensaje,
    telefono,
    volumenEstimado,
    canal,
    tipoConsulta,
    mercado,
    cnpj,
    cargo,
    tipoOrganizacion,
    finalidade,
    aceptoPrivacidad,
    pais,
  } = parsed.data;

  if (mercado === "CO" && !aceptoPrivacidad) {
    return NextResponse.json(
      { error: "Debe aceptar la Política de Tratamiento de Datos Personales." },
      { status: 400 }
    );
  }

  const inbox = getContactInboxEmail();
  const isQuote = tipoConsulta === "cotizacion" || tipoConsulta === "demostracion";
  const isBrazil = mercado === "BR";
  const isColombia = mercado === "CO";
  const canalLabel = canal ? CANAL_LABEL[canal] : "";
  const tipoLabel =
    tipoConsulta === "demostracion"
      ? isBrazil
        ? "Solicitação de demonstração — Brasil"
        : isColombia
          ? "Solicitud de demostración — Colombia"
          : "Solicitud de demostración"
      : tipoConsulta === "cotizacion"
        ? isBrazil
          ? "Solicitação de cotação — Brasil"
          : isColombia
            ? "Solicitud de propuesta — Colombia"
            : "Solicitud de cotización corporativa"
        : isBrazil
          ? "Consulta web — Brasil"
          : isColombia
            ? "Consulta web — Colombia"
            : "Consulta web";
  const finalidadeLabel: Record<z.infer<typeof finalidadeSchema>, string> = {
    cobranca: "Cobrança",
    "pre-negativacao": "Pré-negativação",
    "notificacao-contratual": "Notificação contratual",
    juridico: "Jurídico",
    credito: "Crédito",
    outros: "Outros",
  };
  const orgLabel: Record<z.infer<typeof tipoOrganizacionSchema>, string> = {
    cobranza: "Empresa de cobranza",
    financiera: "Entidad financiera",
    fintech: "Fintech",
    cooperativa: "Cooperativa",
    aseguradora: "Aseguradora",
    retail: "Retail / crédito propio",
    servicios: "Servicios",
    otra: "Otra",
  };
  const mercadoLabel = pais
    ? countryName(pais) || pais
    : isBrazil
      ? "Brasil"
      : isColombia
        ? "Colombia"
        : "Argentina";
  const fullName = apellido ? `${nombre} ${apellido}` : nombre;

  const htmlLines = [
    `<p><strong>Tipo:</strong> ${escapeHtml(tipoLabel)}</p>`,
    `<p><strong>Mercado:</strong> ${escapeHtml(mercadoLabel)}</p>`,
    `<p><strong>Nombre:</strong> ${escapeHtml(fullName)}</p>`,
    `<p><strong>Empresa:</strong> ${escapeHtml(compania || "(no indicada)")}</p>`,
    `<p><strong>Email:</strong> <a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></p>`,
  ];
  if (cargo) {
    htmlLines.push(`<p><strong>Cargo:</strong> ${escapeHtml(cargo)}</p>`);
  }
  if (tipoOrganizacion) {
    htmlLines.push(
      `<p><strong>Tipo de organización:</strong> ${escapeHtml(orgLabel[tipoOrganizacion])}</p>`
    );
  }
  if (cnpj) {
    htmlLines.push(`<p><strong>CNPJ:</strong> ${escapeHtml(cnpj)}</p>`);
  }
  if (telefono) {
    htmlLines.push(
      `<p><strong>${isBrazil ? "WhatsApp" : "Teléfono / WhatsApp"}:</strong> ${escapeHtml(telefono)}</p>`
    );
  }
  if (volumenEstimado) {
    htmlLines.push(
      `<p><strong>Volumen estimado:</strong> ${escapeHtml(volumenEstimado)}</p>`
    );
  }
  if (canalLabel) {
    htmlLines.push(`<p><strong>Canal:</strong> ${escapeHtml(canalLabel)}</p>`);
  }
  if (finalidade.length) {
    htmlLines.push(
      `<p><strong>Finalidade:</strong> ${escapeHtml(
        finalidade.map((item) => finalidadeLabel[item]).join(", ")
      )}</p>`
    );
  }
  if (isColombia) {
    htmlLines.push(
      `<p><strong>Política de datos:</strong> ${aceptoPrivacidad ? "Aceptada" : "No aceptada"}</p>`
    );
  }
  if (mensaje) {
    htmlLines.push(
      `<p><strong>${isQuote ? "Descripción:" : "Mensaje:"}</strong></p><pre style="white-space:pre-wrap;font-family:inherit">${escapeHtml(mensaje)}</pre>`
    );
  }
  htmlLines.push(
    `<p style="color:#666;font-size:12px">Origen: formulario ${
      isColombia
        ? "demostración Colombia"
        : isBrazil
          ? tipoConsulta === "demostracion"
            ? "demonstração Brasil"
            : "cotação Brasil"
          : isQuote
            ? "cotización corporativa"
            : "Contáctenos"
    } (${escapeHtml(process.env.NEXT_PUBLIC_APP_URL || "notificas")})</p>`
  );
  const html = htmlLines.join("\n");
  const text = [
    `Tipo: ${tipoLabel}`,
    `Mercado: ${mercadoLabel}`,
    `Nombre: ${fullName}`,
    `Empresa: ${compania || "(no indicada)"}`,
    cargo ? `Cargo: ${cargo}` : "",
    tipoOrganizacion ? `Tipo de organización: ${orgLabel[tipoOrganizacion]}` : "",
    cnpj ? `CNPJ: ${cnpj}` : "",
    `Email: ${email}`,
    telefono ? `${isBrazil ? "WhatsApp" : "Teléfono / WhatsApp"}: ${telefono}` : "",
    volumenEstimado ? `Volumen estimado: ${volumenEstimado}` : "",
    canalLabel ? `Canal: ${canalLabel}` : "",
    finalidade.length
      ? `Finalidade: ${finalidade.map((item) => finalidadeLabel[item]).join(", ")}`
      : "",
    isColombia ? `Política de datos: ${aceptoPrivacidad ? "Aceptada" : "No aceptada"}` : "",
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
      subject: isColombia
        ? tipoConsulta === "demostracion"
          ? `Demostración Colombia — ${fullName}`
          : `Propuesta Colombia — ${fullName}`
        : isBrazil
        ? tipoConsulta === "demostracion"
          ? `Demonstração Brasil — ${nombre}`
          : `Cotação Brasil — ${nombre}`
        : isQuote
          ? `Cotización corporativa — ${nombre}`
          : `Consulta web — ${nombre}`,
      html,
      text,
      senderName: fullName,
      recipientName: fullName,
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
            (isColombia
              ? "No se pudo enviar el mensaje. Intente más tarde o escríbanos por correo."
              : "No se pudo enviar el mensaje. Intentá más tarde o escribinos por correo."),
        },
        { status: 502 }
      );
    }

    return NextResponse.json({ ok: true as const, docId });
  } catch (e) {
    console.error("POST /api/contact:", e);
    return NextResponse.json(
      { error: isColombia ? "Error al procesar el envío. Intente más tarde." : "Error al procesar el envío. Intentá más tarde." },
      { status: 500 }
    );
  }
}
