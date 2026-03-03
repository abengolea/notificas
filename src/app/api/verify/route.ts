import { NextRequest, NextResponse } from "next/server";
import { FieldPath, type QueryDocumentSnapshot } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";

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

function buildResponsePayload(doc: MailDocument, attachment: any, hash: string) {
  const data = doc.data();
  const sentAt =
    toIsoString(data.sentAt) ||
    toIsoString(data.timestamp) ||
    toIsoString(data.createdAt) ||
    toIsoString(data.delivery?.time);

  const attachmentUrl = attachment?.fileUrl || attachment?.url || attachment?.downloadUrl;
  const attachmentName = attachment?.fileName || attachment?.name;

  const blockchainVerified =
    Boolean(attachment?.integrityCertificate?.verified) ||
    Boolean(data.blockchainHash) ||
    Boolean(data.bfaCertificado?.hashCertificado);

  return {
    docId: doc.id,
    messageId: data.tracking?.messageId || doc.id,
    senderName: data.senderName || data.message?.senderName || data.from,
    recipientEmail: data.recipientEmail || data.to?.[0],
    sentAt,
    hash,
    fileName: attachmentName,
    attachmentUrl,
    blockchainVerified,
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
        return { doc, attachment };
      }
    }
  } catch (error) {
    console.warn("attachmentsHashes query failed:", error);
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
        return { doc, attachment };
      }
    }

    if (snapshot.size < PAGE_SIZE) {
      break;
    }

    lastId = snapshot.docs[snapshot.docs.length - 1].id;
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const hash = typeof body?.hash === "string" ? normalizeHash(body.hash) : null;

    if (!hash) {
      return NextResponse.json(
        { error: "hash es requerido" },
        { status: 400 }
      );
    }

    if (hash.length !== 64) {
      return NextResponse.json(
        { error: "hash inválido" },
        { status: 400 }
      );
    }

    const quickMatch = await queryByHashIndex(hash);
    const match = quickMatch || (await scanMailCollection(hash));

    if (!match) {
      return NextResponse.json(
        { error: "Documento no encontrado", hash },
        { status: 404 }
      );
    }

    const payload = buildResponsePayload(match.doc, match.attachment, hash);

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


