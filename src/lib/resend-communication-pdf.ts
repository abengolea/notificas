import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import QRCode from "qrcode";
import { formatEvidenceTimestamp, PDF_SCHEMA } from "@/lib/pdf-evidence-format";
import {
  PDF_BRAND,
  PDF_MM,
  PDF_TABLE_HEAD,
  PDF_TABLE_MARGIN,
  drawPdfLetterheadMm,
  drawSoftPanelMm,
  drawWarnPanelMm,
  stampPdfChromeMm,
} from "@/lib/pdf-brand";
import { publicCertificateVerifyUrl } from "@/lib/public-verify-url";
import type { HistoricalResendEvent, ResendCommunicationReport } from "@/lib/resend-communication-types";
import type { MetaVerifyStatus } from "@/lib/meta-verify-status";

function statusPdf(status: MetaVerifyStatus): string {
  switch (status) {
    case "VERIFIED":
      return "VERIFIED — consulta actual a api.resend.com";
    case "HISTORICAL_VERIFIED":
      return "HISTORICAL_VERIFIED — HMAC-SHA256 verificado";
    case "HISTORICAL_PRESERVED":
      return "HISTORICAL_PRESERVED — evidencia conservada (HMAC no recomputado)";
    case "NOT_AVAILABLE":
      return "NOT_AVAILABLE";
    case "PENDING":
      return "PENDING";
    case "FAILED":
      return "FAILED";
    case "API_UNAVAILABLE":
      return "API_UNAVAILABLE — consulta en vivo no disponible";
  }
}

function hmacLabel(ev: HistoricalResendEvent): string {
  if (ev.signatureValidation === "correct") {
    return "Autenticación criptográfica verificada (HMAC-SHA256 vs Svix)";
  }
  if (ev.signatureValidation === "ingest_only") {
    return "Firma Svix presente. Validación criptográfica retrospectiva no disponible (RAW no conservado o incompleto)";
  }
  if (ev.signatureValidation === "incorrect") {
    return "La autenticación criptográfica no coincide";
  }
  return "Validación criptográfica no disponible";
}

function lastAutoY(doc: jsPDF, fallback: number): number {
  return (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? fallback;
}

function ensureY(doc: jsPDF, y: number, needed: number): number {
  if (y + needed > PDF_MM.contentBottom) {
    doc.addPage();
    return PDF_MM.continueTop;
  }
  return y;
}

function heading(doc: jsPDF, y: number, text: string): number {
  y = ensureY(doc, y, 10);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...PDF_BRAND.textMain);
  doc.text(text, PDF_MM.margin, y);
  return y + 6;
}

function para(doc: jsPDF, y: number, text: string, muted = false): number {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...(muted ? PDF_BRAND.textMuted : PDF_BRAND.textMain));
  const lines = doc.splitTextToSize(text, PDF_MM.contentWidth);
  for (const line of lines) {
    y = ensureY(doc, y, 5);
    doc.text(line, PDF_MM.margin, y);
    y += 3.8;
  }
  return y + 1;
}

function kvTable(doc: jsPDF, y: number, rows: Array<[string, string]>): number {
  autoTable(doc, {
    startY: y,
    head: [["Campo", "Valor"]],
    body: rows,
    theme: "grid",
    styles: { fontSize: 7.5, cellPadding: 1.6, overflow: "linebreak", textColor: PDF_BRAND.textMain },
    headStyles: PDF_TABLE_HEAD,
    columnStyles: { 0: { cellWidth: 52, fontStyle: "bold" }, 1: { cellWidth: 130 } },
    margin: PDF_TABLE_MARGIN,
  });
  return lastAutoY(doc, y) + 6;
}

function eventOf(report: ResendCommunicationReport, kind: HistoricalResendEvent["kind"]): HistoricalResendEvent | undefined {
  return report.chronology.find((e) => e.kind === kind);
}

function hmacVerified(ev?: HistoricalResendEvent): boolean {
  return ev?.signatureValidation === "correct";
}

export function resendVerificationExecutiveLines(report: ResendCommunicationReport): string[] {
  const liveOk = report.live.email?.status === "VERIFIED";
  const delivered = eventOf(report, "delivered");
  const opened = eventOf(report, "opened");

  let hechos = "Hechos: no constan webhooks históricos de Resend autenticados en esta emisión.";
  if (delivered && hmacVerified(delivered)) {
    hechos =
      "Hechos: Resend informó delivered (MTA receptor aceptó). HMAC-SHA256 verificado. No afirma bandeja de entrada.";
  } else if (delivered) {
    hechos =
      "Hechos: consta delivered histórico de Resend, sin recomputación HMAC. No afirma bandeja de entrada.";
  } else if (report.chronology.some((e) => e.kind === "sent")) {
    hechos = "Hechos: Resend aceptó el mensaje para entrega. No consta delivered histórico autenticado.";
  }
  if (opened) {
    hechos += " opened es señal técnica (pixel/proxy), no lectura fehaciente.";
  }

  return [
    "Qué es: anexo técnico de la comunicación email vía Resend. No es el certificado de lectura.",
    liveOk
      ? "Consulta ahora: GET /emails/{id} contra api.resend.com respondió con last_event."
      : "Consulta ahora: la API de Resend no está completa en esta emisión. Eso no invalida la historia.",
    hechos,
    "HMAC histórico: autentica el webhook recibido. No es por sí solo una notificación fehaciente.",
    "Qué no afirma: bandeja de entrada, identidad civil, ni que open/click sean lectura fehaciente.",
  ];
}

export async function buildResendVerificationPdf(report: ResendCommunicationReport): Promise<ArrayBuffer> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const issuedAt = formatEvidenceTimestamp(new Date().toISOString());
  const mailId = report.identification.notificationId;
  const verifyUrl = publicCertificateVerifyUrl({
    id: mailId,
    campaignId: report.identification.campaignId || undefined,
    kind: "mail_certificate",
  });

  doc.setProperties({
    title: `Constancia de verificación Resend — ${mailId}`,
    subject: "Anexo técnico de comunicación email / Resend. No es el certificado de lectura.",
    creator: "Notificas.com",
    author: "Notificas.com",
  });

  let y = drawPdfLetterheadMm(doc, {
    mode: "first",
    documentTitle: "Constancia de verificación Resend",
    lines: [
      "Anexo técnico de la comunicación email (Resend).",
      "No es el certificado de lectura. delivered no afirma bandeja de entrada.",
    ],
  });

  try {
    const qr = await QRCode.toDataURL(verifyUrl, { margin: 0, width: 160 });
    doc.addImage(qr, "PNG", 176, y, 18, 18);
    doc.setFontSize(6);
    doc.setTextColor(...PDF_BRAND.textMuted);
    doc.text("Validar", 179, y + 20);
    doc.setTextColor(...PDF_BRAND.textMain);
  } catch {
    /* QR opcional */
  }

  y = para(doc, y, `Emitida: ${issuedAt}`, true);
  y = para(doc, y, `Esquema: ${PDF_SCHEMA.resendVerification}`, true);
  y += 2;

  if (report.channel !== "email") {
    y = para(doc, y, "Esta constancia no corresponde a una comunicación email vía Resend.");
    stampPdfChromeMm(doc, {
      pagesWithFirstHeader: [1],
      continueTitle: () => "Constancia de verificación Resend",
      footerLine1: () => `Notificas.com · ${PDF_SCHEMA.resendVerification} · ${mailId}`,
      footerLine2: (page, count) => `Página ${page} de ${count}`,
    });
    return doc.output("arraybuffer");
  }

  y = heading(doc, y, "Resumen para quien valida");
  const exec = resendVerificationExecutiveLines(report);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  const execWrapped = exec.flatMap((line) => doc.splitTextToSize(`• ${line}`, PDF_MM.contentWidth - 6));
  const execH = 6 + execWrapped.length * 3.8;
  y = ensureY(doc, y, execH + 4);
  drawSoftPanelMm(doc, PDF_MM.margin, y - 4, PDF_MM.contentWidth, execH);
  doc.setTextColor(...PDF_BRAND.textMain);
  let ey = y;
  for (const line of execWrapped) {
    doc.text(line, PDF_MM.margin + 3, ey);
    ey += 3.8;
  }
  y = ey + 6;

  y = heading(doc, y, "1. Identificación");
  y = kvTable(doc, y, [
    ["Notification ID", mailId],
    ["Campaign ID", report.identification.campaignId || "—"],
    ["Campaign message ID", report.identification.campaignMessageId || "—"],
    ["Resend email_id", report.identification.emailId || "—"],
    ["SMTP Message-ID", report.identification.smtpMessageId || "—"],
    ["Destinatario", report.identification.recipientEmail || "—"],
    ["Asunto", report.identification.subject || "—"],
  ]);

  y = heading(doc, y, "2. Consulta actual a Resend");
  y = para(
    doc,
    y,
    "GET https://api.resend.com/emails/{id}. last_event no equivale a bandeja de entrada ni a lectura.",
    true
  );
  if (report.liveUnavailable) {
    y = ensureY(doc, y, 14);
    drawWarnPanelMm(doc, PDF_MM.margin, y - 4, PDF_MM.contentWidth, 12);
    doc.setTextColor(...PDF_BRAND.warnText);
    doc.setFontSize(8);
    const warn = doc.splitTextToSize(report.liveUnavailable.message, PDF_MM.contentWidth - 4);
    doc.text(warn, PDF_MM.margin + 2, y + 1);
    y += 14;
  }
  const live = report.live.email;
  y = kvTable(doc, y, [
    ["email_id consultado", live?.emailId || report.identification.emailId || "—"],
    ["Resultado", live ? `${statusPdf(live.status)}. ${live.message}` : report.liveUnavailable?.message || "—"],
    ["last_event", live?.lastEvent || "—"],
    ["created_at (Resend)", formatEvidenceTimestamp(live?.createdAt || null)],
    ["from", live?.from || "—"],
    ["to", live?.to || "—"],
    ["Última consulta", formatEvidenceTimestamp(report.live.lastLiveCheckAt)],
  ]);

  if (report.inconsistencies.length > 0) {
    y = heading(doc, y, "Inconsistencias");
    for (const inc of report.inconsistencies) {
      y = para(doc, y, `${inc.code}: ${inc.message} (${inc.status})`);
    }
  }

  y = heading(doc, y, "3. Cronología informada por Resend (webhooks históricos)");
  y = para(
    doc,
    y,
    "Los estados de entrega y las señales de open/click no se reconsultan como hechos fehacientes. Corresponden a eventos que Resend comunicó a Notificas mediante webhooks Svix.",
    true
  );

  if (report.chronology.length === 0) {
    y = para(doc, y, "No hay eventos Resend conservados para este mensaje.", true);
  }

  for (const ev of report.chronology) {
    y = ensureY(doc, y, 28);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...PDF_BRAND.textMain);
    doc.text(`${ev.title}  ·  ${statusPdf(ev.status)}`, PDF_MM.margin, y);
    y += 5;
    y = para(doc, y, ev.claim);
    y = kvTable(doc, y, [
      ["Fuente", ev.source],
      ["email_id", ev.emailId || "—"],
      ["SMTP Message-ID", ev.smtpMessageId || "—"],
      ["Destinatario informado", ev.recipient || "—"],
      ["Timestamp informado por Resend", formatEvidenceTimestamp(ev.providerTimestamp)],
      ["Recibido por Notificas", formatEvidenceTimestamp(ev.receivedAt)],
      ["Payload original", ev.rawPreserved ? (ev.rawTruncated ? "Preservado (truncado)" : "Preservado") : "No conservado"],
      ["Firma Svix", ev.signatureHeaderPresent ? "Preservada" : "No disponible"],
      ["Autenticación", hmacLabel(ev)],
      [
        "SHA-256 payload",
        ev.integrityMatchesStoredHash === false
          ? `No coincidente · ${ev.payloadSha256 || "—"}`
          : ev.payloadSha256 || "—",
      ],
      ["Clase evidencial", ev.evidentiaryClass],
    ]);
  }

  y = heading(doc, y, "4. Alcance de esta constancia");
  y = para(doc, y, report.disclaimer);
  y = para(doc, y, `Validación pública de la constancia original: ${verifyUrl}`, true);

  stampPdfChromeMm(doc, {
    pagesWithFirstHeader: [1],
    continueTitle: () => "Constancia de verificación Resend (continuación)",
    footerLine1: () => `Notificas.com · ${PDF_SCHEMA.resendVerification} · ${mailId}`,
    footerLine2: (page, count) => `Página ${page} de ${count}`,
  });

  return doc.output("arraybuffer");
}
