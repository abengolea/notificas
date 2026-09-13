import { FieldValue } from "firebase-admin/firestore";
import QRCode from "qrcode";
import jsPDF from "jspdf";
import { getAdminBucket, getAdminDb, sealEvidenceCopy } from "@/lib/firebase-admin";
import { recordIssuedDocument, sha256Hex } from "@/lib/issued-documents";
import { publicCertificateVerifyUrl } from "@/lib/public-verify-url";
import { ART_COLLECTIONS } from "@/lib/art/collections";
import { newArtEvidenceId } from "@/lib/art/ids";
import type { ArtBlockchainStatus, ArtRecipient } from "@/lib/art/types";
import { blockchainStatusLabel, resolveBlockchainStatus } from "@/lib/art/audit-logic";
import {
  artPilotAuditMetadata,
  artPilotEvidenceMarks,
  evidenceRetentionUiCopy,
  evidenceRetentionYears,
} from "@/lib/art/pilot";

export async function generateAdhesionEvidence(input: {
  orgId: string;
  orgName: string;
  orgCuit: string | null;
  recipient: ArtRecipient;
  termsVersion: string;
  termsTitle: string;
  termsHash: string;
  consentHash: string;
  eventHash: string;
  polygonTxHash: string | null;
  blockchainStatus?: ArtBlockchainStatus;
  otpChallengeId: string | null;
  ip: string;
  userAgent: string;
  sessionId: string;
  acceptedAt: string;
}): Promise<{ evidenceId: string; json: Record<string, unknown>; pdfHash: string; verifyUrl: string }> {
  const evidenceId = newArtEvidenceId();
  const blockchainStatus =
    input.blockchainStatus ||
    resolveBlockchainStatus({
      eventHash: input.eventHash,
      polygonTxHash: input.polygonTxHash,
      chainConfigured: Boolean(process.env.POLYGON_PRIVATE_KEY),
      attempted: false,
      failed: false,
    });
  const json: Record<string, unknown> = {
    schema: "notificas.art.adhesion.v1",
    evidenceId,
    adhesionId: input.recipient.adhesionId,
    orgId: input.orgId,
    orgName: input.orgName,
    orgCuit: input.orgCuit,
    recipientId: input.recipient.id,
    worker: {
      fullName: input.recipient.fullName,
      dni: input.recipient.dni,
      cuil: input.recipient.cuil,
      phone: input.recipient.phone,
      email: input.recipient.email,
      phoneVerified: input.recipient.phoneVerified,
      emailVerified: input.recipient.emailVerified,
    },
    identity: {
      provider: input.recipient.identityProvider,
      status: input.recipient.identityVerificationStatus,
      prevalidatedByArt: input.recipient.identityPrevalidatedByArt,
      identityVerificationMethod: input.recipient.identityVerificationMethod,
      identityVerifiedAt: input.recipient.identityVerifiedAt,
      identitySource: input.recipient.identitySource,
      identityExternalReference: input.recipient.identityExternalReference,
      identityVerifiedBy: input.recipient.identityVerifiedBy,
      identityAssuranceLevel: input.recipient.identityAssuranceLevel,
      identityMetadata: input.recipient.identityMetadata,
      biometricStored: false,
    },
    terms: {
      version: input.termsVersion,
      title: input.termsTitle,
      documentHash: input.termsHash,
    },
    consent: {
      acceptedAt: input.acceptedAt,
      ip: input.ip,
      userAgent: input.userAgent,
      sessionId: input.sessionId,
      otpChallengeId: input.otpChallengeId,
      hash: input.consentHash,
    },
    integrity: {
      eventHash: input.eventHash,
      polygonTxHash: blockchainStatus === "BLOCKCHAIN_ANCHORED" ? input.polygonTxHash : null,
      blockchainStatus,
    },
    retention: {
      years: evidenceRetentionYears(),
      copy: evidenceRetentionUiCopy(),
    },
    ...artPilotAuditMetadata(),
    ...(artPilotEvidenceMarks().isTestEvidence
      ? {
          testMode: "PRODUCTION_PILOT",
          disclaimer: "PRUEBA INTERNA NOTIFICAS",
          banner: "TEST MODE: PRODUCTION PILOT",
        }
      : {}),
  };

  const pdf = await buildAdhesionPdf({
    ...input,
    blockchainStatus,
    evidenceId,
    jsonHash: sha256Hex(Buffer.from(JSON.stringify(json))),
  });
  const pdfHash = sha256Hex(pdf);
  const verifyUrl = publicCertificateVerifyUrl({ hash: pdfHash, kind: "art_adhesion", id: evidenceId });

  const path = `art-evidence/${input.orgId}/${evidenceId}.pdf`;
  try {
    const file = getAdminBucket().file(path);
    await file.save(pdf, { contentType: "application/pdf", resumable: false });
    await sealEvidenceCopy(path);
  } catch (e) {
    console.warn("[art] evidence pdf storage:", e instanceof Error ? e.message : e);
  }

  await getAdminDb().collection(ART_COLLECTIONS.evidence).doc(evidenceId).set({
    evidenceId,
    orgId: input.orgId,
    recipientId: input.recipient.id,
    adhesionId: input.recipient.adhesionId,
    json,
    pdfHash,
    pdfPath: path,
    eventHash: input.eventHash,
    polygonTxHash: blockchainStatus === "BLOCKCHAIN_ANCHORED" ? input.polygonTxHash : null,
    blockchainStatus,
    verifyUrl,
    createdAt: FieldValue.serverTimestamp(),
  });

  await recordIssuedDocument(getAdminDb(), {
    hash: pdfHash,
    kind: "art_adhesion",
    orgId: input.orgId,
    orgNombre: input.orgName,
    messageId: evidenceId,
    recipientNombre: input.recipient.fullName,
    txHash: blockchainStatus === "BLOCKCHAIN_ANCHORED" ? input.polygonTxHash : null,
    fileName: `constancia-adhesion-${evidenceId}.pdf`,
  });

  return { evidenceId, json, pdfHash, verifyUrl };
}

export async function getEvidenceForRecipient(orgId: string, recipientId: string) {
  const snap = await getAdminDb()
    .collection(ART_COLLECTIONS.evidence)
    .where("orgId", "==", orgId)
    .where("recipientId", "==", recipientId)
    .limit(5)
    .get();
  if (snap.empty) return null;
  const docs = snap.docs.sort((a, b) => String(b.data().evidenceId).localeCompare(String(a.data().evidenceId)));
  return { id: docs[0].id, ...docs[0].data() };
}

export async function loadEvidencePdf(orgId: string, recipientId: string): Promise<{ buffer: Buffer; fileName: string; json: unknown } | null> {
  const ev = await getEvidenceForRecipient(orgId, recipientId);
  if (!ev) return null;
  const path = String((ev as { pdfPath?: string }).pdfPath || "");
  let buffer: Buffer | null = null;
  if (path) {
    try {
      const [buf] = await getAdminBucket().file(path).download();
      buffer = Buffer.from(buf);
    } catch {
      buffer = null;
    }
  }
  if (!buffer) {
    const rec = ev as {
      json?: Record<string, unknown>;
      evidenceId?: string;
      orgId?: string;
    };
    const rebuilt = await buildAdhesionPdf({
      orgName: String((rec.json as { orgName?: string } | undefined)?.orgName || "ART"),
      orgCuit: String((rec.json as { orgCuit?: string } | undefined)?.orgCuit || ""),
      recipient: {
        fullName: String((rec.json as { worker?: { fullName?: string } } | undefined)?.worker?.fullName || ""),
        dni: String((rec.json as { worker?: { dni?: string } } | undefined)?.worker?.dni || ""),
        cuil: String((rec.json as { worker?: { cuil?: string } } | undefined)?.worker?.cuil || ""),
        phone: String((rec.json as { worker?: { phone?: string } } | undefined)?.worker?.phone || ""),
        email: String((rec.json as { worker?: { email?: string } } | undefined)?.worker?.email || ""),
        adhesionId: String((ev as { adhesionId?: string }).adhesionId || ""),
        identityProvider: String((rec.json as { identity?: { provider?: string } } | undefined)?.identity?.provider || ""),
        identityVerificationStatus: String((rec.json as { identity?: { status?: string } } | undefined)?.identity?.status || ""),
      },
      termsVersion: String((rec.json as { terms?: { version?: string } } | undefined)?.terms?.version || ""),
      termsHash: String((rec.json as { terms?: { documentHash?: string } } | undefined)?.terms?.documentHash || ""),
      consentHash: String((rec.json as { consent?: { hash?: string } } | undefined)?.consent?.hash || ""),
      eventHash: String((ev as { eventHash?: string }).eventHash || ""),
      polygonTxHash: ((ev as { polygonTxHash?: string | null }).polygonTxHash) || null,
      otpChallengeId: String((rec.json as { consent?: { otpChallengeId?: string } } | undefined)?.consent?.otpChallengeId || "") || null,
      ip: String((rec.json as { consent?: { ip?: string } } | undefined)?.consent?.ip || ""),
      userAgent: String((rec.json as { consent?: { userAgent?: string } } | undefined)?.consent?.userAgent || ""),
      acceptedAt: String((rec.json as { consent?: { acceptedAt?: string } } | undefined)?.consent?.acceptedAt || ""),
      evidenceId: String(rec.evidenceId || ""),
      jsonHash: String((ev as { pdfHash?: string }).pdfHash || ""),
    });
    buffer = rebuilt;
  }
  return {
    buffer,
    fileName: `constancia-adhesion-${String((ev as { evidenceId?: string }).evidenceId || recipientId)}.pdf`,
    json: (ev as { json?: unknown }).json || null,
  };
}

export async function buildAdhesionPdf(input: {
  orgName: string;
  orgCuit: string | null | "";
  recipient: {
    fullName: string;
    dni: string;
    cuil: string;
    phone: string;
    email: string;
    adhesionId: string | null;
    identityProvider: string | null;
    identityVerificationStatus: string;
    phoneVerified?: boolean;
    emailVerified?: boolean;
    identityVerificationMethod?: string | null;
    identityVerifiedBy?: string | null;
    identitySource?: string | null;
  };
  termsVersion: string;
  termsHash: string;
  consentHash: string;
  eventHash: string;
  polygonTxHash: string | null;
  blockchainStatus?: ArtBlockchainStatus;
  otpChallengeId: string | null;
  ip: string;
  userAgent: string;
  acceptedAt: string;
  evidenceId: string;
  jsonHash: string;
}): Promise<Buffer> {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  doc.setProperties({
    title: "Constancia de adhesión a notificaciones electrónicas",
    subject: "Constancia técnica. No afirma autorización SRT.",
    creator: "Notificas",
    author: "Notificas",
  });
  const margin = 48;
  let y = 56;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("NOTIFICAS", margin, y);
  y += 22;
  doc.setFontSize(13);
  doc.text("CONSTANCIA DE ADHESIÓN A NOTIFICACIONES ELECTRÓNICAS", margin, y);
  y += 18;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(80);
  doc.text("Documento técnico. No afirma autorización normativa universal.", margin, y);
  const marks = artPilotEvidenceMarks();
  if (marks.banner && marks.subtitle) {
    y += 14;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(160, 40, 40);
    doc.text(marks.banner, margin, y);
    y += 14;
    doc.setFontSize(10);
    doc.text(marks.subtitle, margin, y);
    doc.setTextColor(20);
  } else {
    doc.setTextColor(20);
  }
  y += 28;

  const chainStatus =
    input.blockchainStatus ||
    resolveBlockchainStatus({
      eventHash: input.eventHash,
      polygonTxHash: input.polygonTxHash,
      chainConfigured: false,
      attempted: false,
      failed: false,
    });
  const phoneLabel = input.recipient.phoneVerified === true
    ? `${input.recipient.phone} (validado)`
    : `${input.recipient.phone} (no validado por OTP)`;
  const emailLabel = input.recipient.email
    ? input.recipient.emailVerified === true
      ? `${input.recipient.email} (validado)`
      : `${input.recipient.email} (no validado)`
    : "—";
  const lines: Array<[string, string]> = [
    ["ART", input.orgName + (input.orgCuit ? `  CUIT ${input.orgCuit}` : "")],
    ["Trabajador", input.recipient.fullName],
    ["DNI", input.recipient.dni],
    ["CUIL", input.recipient.cuil],
    ["Teléfono", phoneLabel],
    ["Email", emailLabel],
    ["Fecha/hora (UTC)", input.acceptedAt],
    ["Método de identificación", input.recipient.identityVerificationMethod || input.recipient.identityProvider || "—"],
    ["Identificado por", input.recipient.identityVerifiedBy || "—"],
    ["Fuente de identidad", input.recipient.identitySource || "—"],
    ["Proveedor de identidad", input.recipient.identityProvider || "—"],
    ["Estado identidad", input.recipient.identityVerificationStatus],
    ["Versión de términos", input.termsVersion],
    ["Hash términos", input.termsHash],
    ["IP", input.ip],
    ["User Agent", input.userAgent.slice(0, 90)],
    ["OTP email", input.otpChallengeId ? `verificado (${input.otpChallengeId})` : "—"],
    ["Identificador de adhesión", input.recipient.adhesionId || "—"],
    ["Hash de evidencia", input.eventHash],
    ["Estado blockchain", chainStatus],
    ["Anclaje", blockchainStatusLabel(chainStatus, chainStatus === "BLOCKCHAIN_ANCHORED" ? input.polygonTxHash : null)],
    ["Conservación", evidenceRetentionUiCopy()],
  ];
  doc.setFontSize(10);
  for (const [k, v] of lines) {
    doc.setFont("helvetica", "bold");
    doc.text(`${k}:`, margin, y);
    doc.setFont("helvetica", "normal");
    const wrapped = doc.splitTextToSize(v || "—", 360);
    doc.text(wrapped, margin + 150, y);
    y += Math.max(16, wrapped.length * 12);
    if (y > 720) {
      doc.addPage();
      y = 56;
    }
  }

  const verifyUrl = publicCertificateVerifyUrl({ hash: input.jsonHash, id: input.evidenceId });
  try {
    const qr = await QRCode.toDataURL(verifyUrl, { margin: 0, width: 110 });
    doc.addImage(qr, "PNG", 450, 60, 90, 90);
  } catch {
    /* ignore */
  }
  y += 12;
  doc.setFontSize(8);
  doc.text(`Verificación: ${verifyUrl}`, margin, y);
  y += 14;
  doc.text(`verify-ref: ntf:art_adhesion:${input.evidenceId}`, margin, y);
  return Buffer.from(doc.output("arraybuffer"));
}
