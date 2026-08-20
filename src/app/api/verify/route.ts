import { NextRequest, NextResponse } from "next/server";
import { FieldPath, type QueryDocumentSnapshot } from "firebase-admin/firestore";
import { adminDb, getAdminDb } from "@/lib/firebase-admin";
import { findIssuedDocument, type IssuedDocumentRecord } from "@/lib/issued-documents";
import { buildPublicEvidence } from "@/lib/public-evidence";
import { extractVerifyHints, type IssuedDocKind, type VerifyHints } from "@/lib/verify-hints";
import { verifyQueryFromSearchParams } from "@/lib/public-verify-url";

const PAGE_SIZE = 200;

type MailDocument = QueryDocumentSnapshot<FirebaseFirestore.DocumentData>;

function normalizeHash(hash: string): string {
  return hash.trim().toLowerCase();
}

function extractAttachments(data: FirebaseFirestore.DocumentData) {
  const raw = data.attachments;
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "object") {
    return Object.values(raw);
  }
  return [];
}

function findAttachmentByHash(
  doc: MailDocument,
  targetHash: string
) {
  const attachments = extractAttachments(doc.data());
  return attachments.find((attachment: any) => {
    const candidate = attachment?.hash || attachment?.fileHash || attachment?.integrityCertificate?.hash;
    return typeof candidate === "string" && normalizeHash(candidate) === targetHash;
  });
}

function toIsoString(value: any): string | undefined {
  if (!value) return undefined;
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value.toDate === "function") {
    try {
      return value.toDate().toISOString();
    } catch {
      return undefined;
    }
  }
  return undefined;
}

function collectEvidenceHashes(evidence: Record<string, unknown>, extra?: string[]): string[] {
  const out = new Set<string>();
  const add = (v: unknown) => {
    if (typeof v === "string") {
      const h = normalizeHash(v);
      if (h.length === 64) out.add(h);
    }
  };
  const ch = evidence.contentHash as { stored?: string; current?: string; snapshot?: string } | undefined;
  add(ch?.stored);
  add(ch?.current);
  add(ch?.snapshot);
  add(evidence.snapshotHash);
  add(evidence.merkleRoot);
  extra?.forEach(add);
  return [...out];
}

async function matchHashToRecord(
  hash: string,
  hints: VerifyHints,
  messageId: string | null
): Promise<{ data: Record<string, unknown>; hashKind: string } | null> {
  const issued = await findIssuedDocument(getAdminDb(), hash);
  if (issued) {
    return {
      hashKind: "pdf",
      data: { ...buildCampaignPayload(issued, hash), issuedByNotificas: true },
    };
  }

  if (messageId) {
    const evidence = await buildPublicEvidence(messageId);
    if (evidence) {
      const mailSnap = await adminDb.collection("mail").doc(messageId).get();
      const certs = mailSnap.exists && Array.isArray(mailSnap.data()?.certificateHashes)
        ? (mailSnap.data()!.certificateHashes as string[])
        : [];
      const hashes = collectEvidenceHashes(evidence as unknown as Record<string, unknown>, certs);
      if (hashes.includes(hash)) {
        const hashKind = certs.map((c) => normalizeHash(c)).includes(hash)
          ? "pdf"
          : hash === normalizeHash(String(evidence.merkleRoot || ""))
            ? "merkle"
            : "content";
        return {
          hashKind,
          data: {
            ...evidence,
            hash,
            isCertificate: true,
            integrityValid: evidence.intact,
            issuedByNotificas: true,
          },
        };
      }
    }
  }

  const fromHints = await resolveCampaignFromHints({
    ...hints,
    messageId: hints.messageId || messageId || undefined,
  });
  if (fromHints?.campaignId) {
    const db = getAdminDb();
    if (fromHints.batchId) {
      const batch = await db
        .collection("campaigns")
        .doc(fromHints.campaignId)
        .collection("integrity_batches")
        .doc(fromHints.batchId)
        .get();
      const merkle = typeof batch.data()?.merkleRoot === "string" ? normalizeHash(batch.data()!.merkleRoot) : "";
      if (merkle === hash) {
        return {
          hashKind: "merkle",
          data: {
            ...buildCampaignPayload({ ...fromHints, hash }, hash),
            merkleRoot: merkle,
            issuedByNotificas: true,
          },
        };
      }
    }
    if (fromHints.messageId) {
      const msg = await db.collection("campaign_messages").doc(fromHints.messageId).get();
      const send = (msg.data()?.integrity?.send || {}) as { contentHash?: string; merkleRoot?: string };
      const live = msg.data() as { contentHash?: string } | undefined;
      const candidates = [send.contentHash, send.merkleRoot, live?.contentHash, fromHints.hash].map((v) =>
        typeof v === "string" ? normalizeHash(v) : ""
      );
      if (candidates.includes(hash)) {
        return {
          hashKind: "content",
          data: {
            ...buildCampaignPayload({ ...fromHints, hash }, hash),
            issuedByNotificas: true,
          },
        };
      }
    }
    const camp = await db.collection("campaigns").doc(fromHints.campaignId).get();
    const csvHash = typeof camp.data()?.csvExportHash === "string" ? normalizeHash(camp.data()!.csvExportHash) : "";
    if (csvHash === hash) {
      return {
        hashKind: "csv",
        data: {
          ...buildCampaignPayload({ ...fromHints, hash }, hash),
          issuedByNotificas: true,
        },
      };
    }
  }

  return null;
}
  switch (kind) {
    case "campaign_acta":
      return "Acta de tanda de campaña";
    case "campaign_acta_recipient":
      return "Acta individual de destinatario";
    case "campaign_report":
      return "Reporte legal de campaña";
    default:
      return "Documento de campaña";
  }
}

function campaignKindLabel(kind?: IssuedDocKind): string {
  switch (kind) {
    case "campaign_acta":
      return "Acta de tanda de campaña";
    case "campaign_acta_recipient":
      return "Acta individual de destinatario";
    case "campaign_report":
      return "Reporte legal de campaña";
    default:
      return "Documento de campaña";
  }
}

function buildCampaignPayload(
  record: IssuedDocumentRecord,
  hash: string | null,
  extras?: { blockchainVerified?: boolean }
) {
  return {
    docId: record.campaignId || record.messageId || record.hash,
    messageId: record.messageId || record.campaignId,
    kind: record.kind,
    kindLabel: campaignKindLabel(record.kind),
    senderName: record.orgNombre,
    recipientEmail: record.recipientNombre,
    campaignNombre: record.campaignNombre,
    orgNombre: record.orgNombre,
    batchId: record.batchId,
    hash: hash ?? record.hash,
    fileName: record.fileName,
    blockchainVerified: extras?.blockchainVerified ?? Boolean(record.txHash),
    isCertificate: true,
    isCampaignDocument: true,
  };
}

async function resolveCampaignFromHints(hints: VerifyHints): Promise<IssuedDocumentRecord | null> {
  if (!hints.campaignId && !hints.messageId && !hints.batchId && !hints.campaignNombre) return null;
  const db = getAdminDb();

  if (hints.messageId && hints.kind === "campaign_acta_recipient") {
    const msg = await db.collection("campaign_messages").doc(hints.messageId).get();
    if (!msg.exists) return null;
    const data = msg.data()!;
    const campaignId = String(data.campaignId || hints.campaignId || "");
    const camp = campaignId ? await db.collection("campaigns").doc(campaignId).get() : null;
    const orgId = camp?.exists ? String(camp.data()?.orgId || "") : "";
    const org = orgId ? await db.collection("organizations").doc(orgId).get() : null;
    return {
      hash: "",
      kind: "campaign_acta_recipient",
      campaignId,
      orgId,
      orgNombre: org?.exists ? String(org.data()?.nombre || "") : "",
      campaignNombre: camp?.exists ? String(camp.data()?.nombre || "") : "",
      messageId: hints.messageId,
      recipientNombre: String(data.recipientNombre || ""),
      txHash: (data.integrity?.send as { txHash?: string } | undefined)?.txHash || null,
    };
  }

  if (!hints.campaignId && hints.campaignNombre) {
    const byName = await db.collection("campaigns").where("nombre", "==", hints.campaignNombre).limit(2).get();
    if (byName.size === 1) hints.campaignId = byName.docs[0].id;
  }

  if (hints.campaignId) {
    const camp = await db.collection("campaigns").doc(hints.campaignId).get();
    if (!camp.exists) return null;
    const campaign = camp.data()!;
    const orgId = String(campaign.orgId || "");
    const org = orgId ? await db.collection("organizations").doc(orgId).get() : null;
    let txHash: string | null = null;
    if (hints.batchId) {
      const batch = await camp.ref.collection("integrity_batches").doc(hints.batchId).get();
      if (!batch.exists) return null;
      txHash = typeof batch.data()?.txHash === "string" ? batch.data()!.txHash : null;
    }
    return {
      hash: "",
      kind: hints.kind || (hints.batchId ? "campaign_acta" : "campaign_report"),
      campaignId: hints.campaignId,
      orgId,
      orgNombre: org?.exists ? String(org.data()?.nombre || "") : "",
      campaignNombre: String(campaign.nombre || ""),
      batchId: hints.batchId,
      messageId: hints.messageId,
      txHash,
    };
  }

  return null;
}

function buildResponsePayload(
  doc: MailDocument,
  attachment: any | null,
  hash: string | null,
  options: { isCertificateVerification?: boolean } = {}
) {
  const data = doc.data();
  const sentAt =
    toIsoString(data.sentAt) ||
    toIsoString(data.timestamp) ||
    toIsoString(data.createdAt) ||
    toIsoString(data.delivery?.time);

  const attachmentUrl = attachment?.fileUrl || attachment?.url || attachment?.downloadUrl;
  const attachmentName = attachment?.fileName || attachment?.name;

  const isPolygonTxHash = (v: unknown): boolean =>
    typeof v === 'string' && /^0x[0-9a-f]{64}$/i.test(v);

  const blockchainVerified =
    isPolygonTxHash(data.polygonCertifications?.send) ||
    isPolygonTxHash(data.polygonCertifications?.whatsapp) ||
    isPolygonTxHash(data.polygonCertifications?.waDelivered) ||
    isPolygonTxHash(data.polygonCertifications?.waRead) ||
    isPolygonTxHash(data.polygonCertifications?.contentAccess) ||
    isPolygonTxHash(data.polygonCertifications?.readConfirmed) ||
    isPolygonTxHash(data.polygonCertifications?.receive) ||
    isPolygonTxHash(data.polygonCertifications?.read) ||
    isPolygonTxHash(attachment?.integrityCertificate?.txHash);

  return {
    docId: doc.id,
    messageId: data.tracking?.messageId || doc.id,
    senderName: data.senderName || data.message?.senderName || data.from,
    recipientEmail: data.recipientEmail || data.to?.[0],
    sentAt,
    hash: hash ?? undefined,
    fileName: attachmentName,
    attachmentUrl,
    blockchainVerified,
    isCertificate: options.isCertificateVerification ?? false,
  };
}

async function queryByHashIndex(hash: string) {
  try {
    const snapshot = await adminDb
      .collection("mail")
      .where("attachmentsHashes", "array-contains", hash)
      .limit(1)
      .get();

    if (!snapshot.empty) {
      const doc = snapshot.docs[0];
      const attachment = findAttachmentByHash(doc, hash);
      if (attachment) {
        return { doc, attachment, isCertificate: false };
      }
    }
  } catch (error) {
    console.warn("attachmentsHashes query failed:", error);
  }
  return null;
}

async function queryByCertificateHash(hash: string) {
  try {
    const snapshot = await adminDb
      .collection("mail")
      .where("certificateHashes", "array-contains", hash)
      .limit(1)
      .get();

    if (!snapshot.empty) {
      return { doc: snapshot.docs[0], attachment: null, isCertificate: true };
    }
  } catch (error) {
    console.warn("certificateHashes query failed:", error);
  }
  return null;
}

async function scanMailCollection(hash: string) {
  const collectionRef = adminDb.collection("mail");
  let lastId: string | undefined;

  while (true) {
    let queryRef = collectionRef
      .orderBy(FieldPath.documentId())
      .limit(PAGE_SIZE);

    if (lastId) {
      queryRef = queryRef.startAfter(lastId);
    }

    const snapshot = await queryRef.get();
    if (snapshot.empty) break;

    for (const doc of snapshot.docs) {
      const attachment = findAttachmentByHash(doc, hash);
      if (attachment) {
        return { doc, attachment, isCertificate: false };
      }
    }

    if (snapshot.size < PAGE_SIZE) {
      break;
    }

    lastId = snapshot.docs[snapshot.docs.length - 1].id;
  }

  return null;
}

/**
 * Verifica un documento por hash (adjuntos) o por messageId (certificado de lectura).
 * El certificado de lectura PDF se genera dinámicamente y su hash no se guarda,
 * por eso se permite verificar ingresando el ID del mensaje que figura en el certificado.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const hash = typeof body?.hash === "string" ? normalizeHash(body.hash) : null;
    const messageId = typeof body?.messageId === "string" ? body.messageId.trim() : null;
    const fileName = typeof body?.fileName === "string" ? body.fileName : undefined;
    const hintText = typeof body?.hintText === "string" ? body.hintText : "";
    const hints = extractVerifyHints(hintText, fileName);
    if (typeof body?.campaignId === "string" && body.campaignId.trim()) {
      hints.campaignId = body.campaignId.trim();
    }
    if (typeof body?.batchId === "string" && body.batchId.trim()) {
      hints.batchId = body.batchId.trim();
    }
    if (typeof body?.campaignNombre === "string" && body.campaignNombre.trim()) {
      hints.campaignNombre = body.campaignNombre.trim();
    }
    if (typeof body?.kind === "string" && body.kind.trim()) {
      hints.kind = body.kind as IssuedDocKind;
    }
    if (messageId && !hints.messageId) hints.messageId = messageId;

    const fromQr =
      Boolean(hash && hash.length === 64) &&
      !fileName &&
      !hintText &&
      Boolean(messageId || hints.campaignId || hints.batchId);

    if (hash && hash.length === 64) {
      const matched = await matchHashToRecord(hash, hints, messageId);
      if (matched) {
        return NextResponse.json({
          success: true,
          data: { ...matched.data, hashKind: matched.hashKind, hash },
        });
      }
      if (fromQr) {
        return NextResponse.json(
          { error: "El hash no coincide con un registro de Notificas", hash },
          { status: 404 }
        );
      }
    }

    // Verificación por messageId (certificado de lectura + recálculo de integridad)
    if (messageId && !hash) {
      const evidence = await buildPublicEvidence(messageId);
      if (evidence) {
        return NextResponse.json({
          success: true,
          data: {
            ...evidence,
            isCertificate: true,
            integrityValid: evidence.intact,
            issuedByNotificas: true,
          },
        });
      }

      const fromId =
        (await resolveCampaignFromHints({
          ...hints,
          messageId,
          kind: hints.kind || "campaign_acta_recipient",
        })) ||
        (await resolveCampaignFromHints({
          ...hints,
          campaignId: messageId,
          kind: hints.kind || "campaign_report",
        }));
      if (fromId) {
        return NextResponse.json({
          success: true,
          data: {
            ...buildCampaignPayload(fromId, null),
            issuedByNotificas: true,
          },
        });
      }

      return NextResponse.json(
        { error: "Documento no encontrado", messageId },
        { status: 404 }
      );
    }

    if (hints.campaignId || hints.batchId) {
      const fromCampaign = await resolveCampaignFromHints(hints);
      if (fromCampaign) {
        return NextResponse.json({
          success: true,
          data: {
            ...buildCampaignPayload(fromCampaign, null),
            issuedByNotificas: true,
          },
        });
      }
      return NextResponse.json(
        { error: "Documento no encontrado", campaignId: hints.campaignId, batchId: hints.batchId },
        { status: 404 }
      );
    }

    // Verificación por hash (adjuntos de correo)
    if (!hash) {
      return NextResponse.json(
        { error: "hash o messageId es requerido" },
        { status: 400 }
      );
    }

    if (hash.length !== 64) {
      return NextResponse.json(
        { error: "hash inválido (debe ser SHA-256 en hexadecimal)" },
        { status: 400 }
      );
    }

    const issued = await findIssuedDocument(getAdminDb(), hash);
    if (issued) {
      return NextResponse.json({
        success: true,
        data: { ...buildCampaignPayload(issued, hash), issuedByNotificas: true },
      });
    }

    const fromHints = await resolveCampaignFromHints(hints);
    if (fromHints) {
      return NextResponse.json({
        success: true,
        data: { ...buildCampaignPayload(fromHints, hash), issuedByNotificas: true },
      });
    }

    const quickMatch =
      (await queryByHashIndex(hash)) ||
      (await queryByCertificateHash(hash)) ||
      (await scanMailCollection(hash));

    if (!quickMatch) {
      return NextResponse.json(
        { error: "Documento no encontrado", hash },
        { status: 404 }
      );
    }

    const payload = buildResponsePayload(
      quickMatch.doc,
      quickMatch.attachment,
      hash,
      { isCertificateVerification: quickMatch.isCertificate }
    );

    return NextResponse.json({
      success: true,
      data: payload,
    });
  } catch (error) {
    console.error("Error verificando documento:", error);
    return NextResponse.json(
      { error: "Error interno del verificador" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const q = verifyQueryFromSearchParams(request.nextUrl.searchParams);
  if (q.hash) {
    const matched = await matchHashToRecord(q.hash, {
      campaignId: q.campaignId,
      batchId: q.batchId,
      kind: q.kind,
      messageId: q.id,
    }, q.id || null);
    if (matched) {
      return NextResponse.json({
        success: true,
        data: { ...matched.data, hashKind: matched.hashKind, hash: q.hash, issuedByNotificas: true },
      });
    }
    if (q.id || q.campaignId || q.batchId) {
      return NextResponse.json({ error: "El hash no coincide con un registro de Notificas", hash: q.hash }, { status: 404 });
    }
    return NextResponse.json({ error: "Documento no encontrado", hash: q.hash }, { status: 404 });
  }
  if (q.id) {
    const evidence = await buildPublicEvidence(q.id);
    if (evidence) {
      return NextResponse.json({
        success: true,
        data: { ...evidence, isCertificate: true, integrityValid: evidence.intact, issuedByNotificas: true },
      });
    }
    const fromId = await resolveCampaignFromHints({
      messageId: q.id,
      campaignId: q.campaignId,
      batchId: q.batchId,
      kind: q.kind || "campaign_acta_recipient",
    });
    if (fromId) {
      return NextResponse.json({
        success: true,
        data: { ...buildCampaignPayload(fromId, null), issuedByNotificas: true },
      });
    }
    return NextResponse.json({ error: "Documento no encontrado", messageId: q.id }, { status: 404 });
  }
  if (q.campaignId || q.batchId) {
    const fromCampaign = await resolveCampaignFromHints({
      campaignId: q.campaignId,
      batchId: q.batchId,
      kind: q.kind,
    });
    if (fromCampaign) {
      return NextResponse.json({
        success: true,
        data: { ...buildCampaignPayload(fromCampaign, null), issuedByNotificas: true },
      });
    }
    return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });
  }
  return NextResponse.json({ error: "id, messageId, campaignId o hash es requerido" }, { status: 400 });
}


