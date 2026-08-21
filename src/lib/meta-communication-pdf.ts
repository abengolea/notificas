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
import type { HistoricalMetaEvent, MetaCommunicationReport, MetaLiveIdentity } from "@/lib/meta-communication-types";
import type { MetaVerifyStatus } from "@/lib/meta-verify-status";

function statusPdf(status: MetaVerifyStatus): string {
  switch (status) {
    case "VERIFIED":
      return "VERIFIED — consulta actual a Meta Graph API";
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

function hmacLabel(ev: HistoricalMetaEvent): string {
  if (ev.signatureValidation === "correct") {
    return "Autenticación criptográfica verificada (HMAC-SHA256 vs X-Hub-Signature-256)";
  }
  if (ev.signatureValidation === "ingest_only") {
    return "Firma X-Hub-Signature-256 presente. Validación criptográfica retrospectiva no disponible";
  }
  if (ev.signatureValidation === "incorrect") {
    return "La autenticación criptográfica no coincide";
  }
  return "Validación criptográfica no disponible";
}

function wamidSourceText(report: MetaCommunicationReport): string {
  switch (report.message.wamidSource) {
    case "graph_http_raw":
      return "Se conservó el cuerpo HTTP RAW de la respuesta de Meta al POST /messages. El WAMID extraído coincide.";
    case "parsed_graph_json":
      return "El WAMID registrado corresponde al identificador devuelto por Meta. Para esta comunicación se conservó el identificador extraído, no el cuerpo HTTP RAW completo.";
    case "extracted_id_only":
      return "Se conservó el WAMID extraído. No hay cuerpo HTTP RAW de la respuesta de envío.";
    default:
      return "No hay WAMID conservado.";
  }
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

function liveNameLabel(objectLabel: string): string {
  if (objectLabel.includes("Template")) return "Nombre del template (Graph)";
  if (objectLabel.includes("WABA")) return "Nombre WABA (Graph)";
  return `${objectLabel} — nombre (Graph)`;
}

function liveRow(label: string, id: string | null, live: MetaLiveIdentity | null): Array<[string, string]> {
  const rows: Array<[string, string]> = [[label, id || "—"]];
  if (live) {
    rows.push([`${label} — resultado`, `${statusPdf(live.status)}. ${live.message}`]);
    if (live.fields.displayPhoneNumber) {
      rows.push(["Número WhatsApp Business (Graph)", live.fields.displayPhoneNumber]);
    }
    if (live.fields.verifiedName) rows.push(["Nombre verificado (Graph)", live.fields.verifiedName]);
    if (live.fields.name) rows.push([liveNameLabel(label), live.fields.name]);
  }
  return rows;
}

function eventOf(report: MetaCommunicationReport, kind: HistoricalMetaEvent["kind"]): HistoricalMetaEvent | undefined {
  return report.chronology.find((e) => e.kind === kind);
}

function hmacVerified(ev?: HistoricalMetaEvent): boolean {
  return ev?.signatureValidation === "correct";
}

function merkleAnchored(ev?: HistoricalMetaEvent): boolean {
  return Boolean(ev?.polygon?.merkleValid === true && ev?.polygon?.txHash);
}

/** Cinco líneas para que AFIP no tenga que leer el detalle técnico. */
export function metaVerificationExecutiveLines(report: MetaCommunicationReport): string[] {
  const graphOk =
    report.live.waba?.status === "VERIFIED" &&
    report.live.phone?.status === "VERIFIED" &&
    report.live.template?.status === "VERIFIED";
  const delivered = eventOf(report, "delivered");
  const read = eventOf(report, "read");
  const rec = report.recipientEvidence;

  let hechos = "Hechos: no constan webhooks históricos de entrega o lectura autenticados en esta emisión.";
  if (delivered && hmacVerified(delivered) && read && hmacVerified(read)) {
    hechos =
      "Hechos: Meta informó delivered y read. Ambos webhooks tienen HMAC-SHA256 verificado contra X-Hub-Signature-256.";
  } else if (delivered && hmacVerified(delivered)) {
    hechos = "Hechos: Meta informó delivered con HMAC-SHA256 verificado. La lectura no está autenticada o no consta.";
  } else if (read && hmacVerified(read)) {
    hechos = "Hechos: Meta informó read con HMAC-SHA256 verificado. La entrega no está autenticada o no consta.";
  } else if (rec.delivered || rec.read) {
    hechos =
      "Hechos: constan estados históricos informados por Meta, pero esta emisión no afirma autenticación criptográfica HMAC.";
  }

  const tx = delivered?.polygon?.txHash || read?.polygon?.txHash || "";
  let ancla = "Anclaje: no consta hoja Merkle verificada ni transacción Polygon para estos eventos.";
  if (merkleAnchored(delivered) && merkleAnchored(read)) {
    ancla = `Anclaje: delivered y read están en el árbol Merkle (prueba válida) y en Polygon${tx ? ` (${tx.slice(0, 18)}…)` : ""}.`;
  } else if (merkleAnchored(delivered) || merkleAnchored(read)) {
    ancla = "Anclaje: hay prueba Merkle válida y transacción Polygon para parte de los eventos, no para todos.";
  }

  return [
    "Qué es: anexo técnico de la comunicación WhatsApp. No es el certificado de lectura.",
    graphOk
      ? "Infraestructura ahora: WABA, número WhatsApp Business y template verificados hoy contra Meta Graph API."
      : "Infraestructura ahora: la consulta en vivo a Meta no está completa en esta emisión.",
    hechos,
    ancla,
    "Qué no afirma: Meta no reconsulta hoy el WAMID. Este PDF no es la prueba inmutable; si hay anclaje, la da Polygon.",
  ];
}

export async function buildMetaVerificationPdf(report: MetaCommunicationReport): Promise<ArrayBuffer> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const issuedAt = formatEvidenceTimestamp(new Date().toISOString());
  const mailId = report.identification.notificationId;
  const verifyUrl = publicCertificateVerifyUrl({
    id: mailId,
    campaignId: report.identification.campaignId || undefined,
    kind: "mail_certificate",
  });

  doc.setProperties({
    title: `Constancia de verificación Meta — ${mailId}`,
    subject: "Anexo técnico de comunicación WhatsApp / Meta. No es el certificado de lectura.",
    creator: "Notificas.com",
    author: "Notificas.com",
  });

  let y = drawPdfLetterheadMm(doc, {
    mode: "first",
    documentTitle: "Constancia de verificación Meta",
    lines: [
      "Anexo técnico de la comunicación WhatsApp Business.",
      "No es el certificado de lectura. No afirma que Meta confirme hoy entrega o lectura.",
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
  y = para(doc, y, `Esquema: ${PDF_SCHEMA.metaVerification}`, true);
  y += 2;

  if (report.channel !== "whatsapp") {
    y = para(doc, y, "Esta constancia no corresponde a una comunicación WhatsApp.");
    stampPdfChromeMm(doc, {
      pagesWithFirstHeader: [1],
      continueTitle: () => "Constancia de verificación Meta",
      footerLine1: () => `Notificas.com · ${PDF_SCHEMA.metaVerification} · ${mailId}`,
      footerLine2: (page, count) => `Página ${page} de ${count}`,
    });
    return doc.output("arraybuffer");
  }

  y = heading(doc, y, "Resumen para quien valida");
  const exec = metaVerificationExecutiveLines(report);
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
    ["WAMID", report.identification.wamid || "—"],
    ["WABA ID (evidencia)", report.identification.wabaId || "—"],
    ["Phone Number ID (emisor)", report.identification.phoneNumberId || "—"],
    ["Template", `${report.identification.templateName || "—"} (${report.identification.templateLang || "—"})`],
    ["Template ID", report.identification.templateId || "—"],
  ]);

  y = heading(doc, y, "2. Validación directa con Meta Graph API");
  y = para(
    doc,
    y,
    "Consulta actual al emisor (cuenta WhatsApp Business de Notificas). No identifica al destinatario.",
    true
  );
  if (report.liveUnavailable) {
    y = ensureY(doc, y, 12);
    drawWarnPanelMm(doc, PDF_MM.margin, y - 4, PDF_MM.contentWidth, 10);
    doc.setTextColor(...PDF_BRAND.warnText);
    doc.setFontSize(8);
    const warn = doc.splitTextToSize(report.liveUnavailable.message, PDF_MM.contentWidth - 4);
    doc.text(warn, PDF_MM.margin + 2, y + 1);
    y += 12;
  }
  y = kvTable(doc, y, [
    ...liveRow("WABA ID", report.identification.wabaId, report.live.waba),
    ...liveRow("Phone Number ID", report.identification.phoneNumberId, report.live.phone),
    ...liveRow("Template ID", report.identification.templateId, report.live.template),
    [
      "Nombre / idioma vs snapshot",
      report.live.templateNameMatchesSnapshot && report.live.templateLangMatchesSnapshot
        ? "Coinciden con la evidencia conservada al envío"
        : "No se afirma coincidencia automática del texto histórico con el template vivo",
    ],
    ["Última consulta Graph", formatEvidenceTimestamp(report.live.lastLiveCheckAt)],
  ]);
  y = para(doc, y, report.live.templateContentHistoricalNote, true);

  y = heading(doc, y, "3. Destinatario — evidencia histórica");
  const rec = report.recipientEvidence;
  y = kvTable(doc, y, [
    ["Número consignado en la constancia", rec.consignedPhone || "—"],
    ["recipient_id informado por Meta", rec.webhookRecipientId || "—"],
    ["Confrontación", rec.matchMessage],
    ["Meta informó delivered", rec.delivered ? "Sí (webhook histórico)" : "No consta en la evidencia conservada"],
    ["Meta informó read", rec.read ? "Sí (webhook histórico)" : "No consta en la evidencia conservada"],
    ["Payload webhook preservado", rec.rawPreserved ? "Sí" : "No"],
  ]);
  if (rec.summary) y = para(doc, y, rec.summary, true);
  if (rec.sourceNote) y = para(doc, y, rec.sourceNote, true);

  y = heading(doc, y, "4. Identificador del mensaje (WAMID)");
  y = para(doc, y, report.message.explanation);
  y = kvTable(doc, y, [
    ["WAMID", report.message.wamid || "—"],
    ["Origen del WAMID", wamidSourceText(report)],
    ["HTTP status POST /messages", report.message.sendHttpStatus != null ? String(report.message.sendHttpStatus) : "—"],
    ["SHA-256 respuesta de envío", report.message.sendBodyHash || "—"],
  ]);

  if (report.inconsistencies.length > 0) {
    y = heading(doc, y, "Inconsistencias");
    for (const inc of report.inconsistencies) {
      y = para(doc, y, `${inc.code}: ${inc.message} (${inc.status})`);
    }
  }

  y = heading(doc, y, "5. Cronología informada por Meta (webhooks históricos)");
  y = para(
    doc,
    y,
    "Los estados de entrega y lectura no se consultan actualmente a Meta. Corresponden a eventos que Meta comunicó oportunamente a Notificas mediante webhooks.",
    true
  );

  if (report.chronology.length === 0) {
    y = para(doc, y, "No hay eventos Meta conservados para este mensaje.", true);
  }

  for (const ev of report.chronology) {
    y = ensureY(doc, y, 28);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...PDF_BRAND.textMain);
    doc.text(`${ev.title}  ·  ${statusPdf(ev.status)}`, PDF_MM.margin, y);
    y += 5;
    y = para(doc, y, ev.claim);
    const rows: Array<[string, string]> = [
      ["Fuente", ev.source],
      ["WAMID", ev.wamid || "—"],
      ["recipient_id", ev.recipientId || "—"],
      ["Timestamp informado por Meta", formatEvidenceTimestamp(ev.metaTimestamp)],
      ["Recibido por Notificas", formatEvidenceTimestamp(ev.receivedAt)],
    ];
    if (ev.kind !== "sent") {
      rows.push(
        ["Payload original", ev.rawPreserved ? (ev.rawTruncated ? "Preservado (truncado)" : "Preservado") : "No conservado"],
        ["X-Hub-Signature-256", ev.signatureHeaderPresent ? "Preservada" : "No disponible"],
        ["Autenticación", hmacLabel(ev)],
        [
          "SHA-256 payload",
          ev.integrityMatchesStoredHash === false
            ? `No coincidente · ${ev.payloadSha256 || "—"}`
            : ev.payloadSha256 || "—",
        ],
        ["Merkle leaf", ev.polygon?.leafHash || "—"],
        [
          "Merkle proof",
          ev.polygon?.proof?.length
            ? `${ev.polygon.proof.length} hermanos · índice ${ev.polygon.leafIndex ?? "—"} · servidor: ${
                ev.polygon.merkleValid === true ? "válida" : ev.polygon.merkleValid === false ? "no válida" : "no disponible"
              }`
            : "—",
        ],
        ["Merkle root", ev.polygon?.merkleRoot || "—"],
        [
          "Transaction Hash (Polygon)",
          ev.polygon?.txHash
            ? `${ev.polygon.txHash}\nhttps://polygonscan.com/tx/${ev.polygon.txHash}`
            : "—",
        ]
      );
    } else {
      rows.push(["Respuesta RAW POST /messages", ev.rawPreserved ? "Preservada" : "No conservada para esta comunicación"]);
    }
    y = kvTable(doc, y, rows);
  }

  y = heading(doc, y, "6. Alcance de esta constancia");
  y = para(doc, y, report.disclaimer);
  y = para(
    doc,
    y,
    "Este PDF es un anexo emitido por Notificas a partir de evidencia técnica conservada y, cuando está disponible, de una consulta contemporánea a Meta Graph API. La inmutabilidad de un anclaje Merkle, si consta, la aporta la transacción de Polygon citada, no este archivo.",
    true
  );
  y = para(doc, y, `Validación pública de la constancia original: ${verifyUrl}`, true);

  stampPdfChromeMm(doc, {
    pagesWithFirstHeader: [1],
    continueTitle: () => "Constancia de verificación Meta (continuación)",
    footerLine1: () => `Notificas.com · ${PDF_SCHEMA.metaVerification} · ${mailId}`,
    footerLine2: (page, count) => `Página ${page} de ${count}`,
  });

  return doc.output("arraybuffer");
}
