import { createHash } from "crypto";
import fs from "fs";
import path from "path";
import jsPDF from "jspdf";
import { getAdminBucket, sealEvidenceCopy } from "@/lib/firebase-admin";

export type ConstanciaEnvioInput = {
  mailId: string;
  sender: {
    email: string;
    orgNombre: string | null;
    orgCuit: string | null;
  };
  recipient: {
    nombre: string;
    email: string;
    phone: string;
    dni: string;
    cuit?: string;
  };
  channel: string;
  subject: string;
  contentText: string;
  contentHash: string;
  snapshotHash: string;
  smtp: { messageId: string | null };
  whatsapp: {
    bodyHash: string | null;
    wamid: string | null;
    templateName: string | null;
  };
  attachments: Array<{ fileName: string; hash: string }>;
};

const COLORS = {
  primaryDark: [14, 110, 115] as [number, number, number],
  border: [165, 178, 182] as [number, number, number],
  textMain: [17, 24, 39] as [number, number, number],
  textMuted: [72, 82, 90] as [number, number, number],
};

export function constanciaEnvioStoragePath(mailId: string) {
  return `certificates/${mailId}/constancia-envio.pdf`;
}

export async function generateConstanciaEnvioPdf(data: ConstanciaEnvioInput): Promise<Buffer> {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const issuedAt = new Date();
  doc.setProperties({
    title: `Constancia de envío - ${data.mailId}`,
    subject: "Constancia técnica de envío. No es el certificado de lectura.",
    creator: "Notificas.com",
    author: "Notificas.com",
  });
  const pdfMeta = doc as jsPDF & {
    setCreationDate?: (date: Date) => unknown;
    setFileId?: (id: string) => unknown;
  };
  pdfMeta.setCreationDate?.(issuedAt);
  pdfMeta.setFileId?.(
    createHash("sha256")
      .update(`notificas-envio|${data.mailId}|${data.snapshotHash}`)
      .digest("hex")
      .slice(0, 32)
  );

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 42;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  const setMuted = () => doc.setTextColor(...COLORS.textMuted);
  const setMain = () => doc.setTextColor(...COLORS.textMain);

  try {
    const logoPath = path.join(process.cwd(), "public", "notificasLogo.jpg");
    if (fs.existsSync(logoPath)) {
      const logoBase64 = fs.readFileSync(logoPath, { encoding: "base64" });
      doc.addImage(logoBase64, "JPEG", pageWidth / 2 - 18, y, 36, 36);
      y += 44;
    }
  } catch {
    // logo opcional
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...COLORS.primaryDark);
  doc.text("Constancia de envío", pageWidth / 2, y, { align: "center" });
  y += 18;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  setMuted();
  const aviso = doc.splitTextToSize(
    "Documento al momento del envío. No es el certificado de lectura. Ese otro PDF lo emitís después, una sola vez, y no se le agregan hechos posteriores.",
    contentWidth
  );
  doc.text(aviso, pageWidth / 2, y, { align: "center" });
  y += aviso.length * 12 + 14;

  doc.setDrawColor(...COLORS.border);
  doc.setLineWidth(0.65);
  doc.line(margin, y, pageWidth - margin, y);
  y += 18;

  const rows: Array<[string, string]> = [
    ["Identificador", data.mailId],
    ["Remitente", [data.sender.orgNombre, data.sender.email, data.sender.orgCuit && `CUIT ${data.sender.orgCuit}`].filter(Boolean).join(" · ")],
    ["Destinatario", [data.recipient.nombre, data.recipient.email, data.recipient.phone].filter(Boolean).join(" · ")],
    ...(data.recipient.dni ? [["DNI", data.recipient.dni] as [string, string]] : []),
    ...(data.recipient.cuit ? [["CUIT destinatario", data.recipient.cuit] as [string, string]] : []),
    ["Canal", data.channel || "—"],
    ["Asunto", data.subject || "—"],
    ["Hash del texto (SHA-256)", data.contentHash || "—"],
    ["Hash del expediente", data.snapshotHash || "—"],
    ["SMTP Message-ID", data.smtp.messageId || "—"],
    ["WhatsApp template", data.whatsapp.templateName || "—"],
    ["Hash del pedido a Meta", data.whatsapp.bodyHash || "—"],
    ["WAMID", data.whatsapp.wamid || "—"],
  ];

  doc.setFontSize(9);
  for (const [label, value] of rows) {
    if (y > pageHeight - 72) {
      doc.addPage();
      y = margin;
    }
    doc.setFont("helvetica", "bold");
    setMain();
    doc.text(label, margin, y);
    doc.setFont("courier", "normal");
    const valueLines = doc.splitTextToSize(value || "—", contentWidth);
    y += 12;
    doc.setFont("helvetica", "normal");
    setMain();
    if (label.startsWith("Hash") || label === "WAMID" || label === "SMTP Message-ID") {
      doc.setFont("courier", "normal");
      doc.setFontSize(8);
    }
    doc.text(valueLines, margin, y);
    y += valueLines.length * 11 + 8;
    doc.setFontSize(9);
  }

  if (data.attachments.length) {
    if (y > pageHeight - 90) {
      doc.addPage();
      y = margin;
    }
    doc.setFont("helvetica", "bold");
    setMain();
    doc.text("Adjuntos (hash al subir)", margin, y);
    y += 14;
    doc.setFont("helvetica", "normal");
    for (const att of data.attachments) {
      const line = doc.splitTextToSize(`${att.fileName}  ${att.hash || "sin hash"}`, contentWidth);
      if (y + line.length * 11 > pageHeight - 56) {
        doc.addPage();
        y = margin;
      }
      doc.text(line, margin, y);
      y += line.length * 11 + 6;
    }
  }

  if (y > pageHeight - 120) {
    doc.addPage();
    y = margin;
  }
  doc.setFont("helvetica", "bold");
  setMain();
  doc.text("Texto sellado", margin, y);
  y += 14;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const body = data.contentText?.trim() || "(sin texto)";
  const bodyLines = doc.splitTextToSize(body, contentWidth);
  for (const line of bodyLines) {
    if (y > pageHeight - 56) {
      doc.addPage();
      y = margin;
    }
    doc.text(line, margin, y);
    y += 12;
  }

  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    setMuted();
    doc.text(
      `Notificas.com · constancia de envío · ${data.mailId} · pág. ${p}/${pages}`,
      pageWidth / 2,
      pageHeight - 28,
      { align: "center" }
    );
  }

  return Buffer.from(doc.output("arraybuffer"));
}

/** Primera escritura gana. No se reconstruye desde el mail vivo. */
export async function persistConstanciaEnvio(mailId: string, snapshot: ConstanciaEnvioInput): Promise<void> {
  if (!mailId) return;
  const storagePath = constanciaEnvioStoragePath(mailId);
  const file = getAdminBucket().file(storagePath);
  const [exists] = await file.exists();
  if (!exists) {
    const buffer = await generateConstanciaEnvioPdf({ ...snapshot, mailId });
    try {
      await file.save(buffer, {
        resumable: false,
        contentType: "application/pdf",
        metadata: { cacheControl: "private,max-age=31536000" },
        preconditionOpts: { ifGenerationMatch: 0 },
      });
    } catch (e: unknown) {
      const code = typeof e === "object" && e && "code" in e ? Number((e as { code?: number }).code) : 0;
      if (code !== 412) throw e;
    }
  }
  await sealEvidenceCopy(storagePath);
}
