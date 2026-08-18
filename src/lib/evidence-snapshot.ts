import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb, writeWormSnapshot } from "@/lib/firebase-admin";
import { persistConstanciaEnvio } from "@/lib/constancia-envio-pdf";
import { computeContentHash } from "@/lib/certification";
import { sha256Hex } from "@/lib/merkle";
import { recordProviderEvent } from "@/lib/provider-events";
import { hashWhatsAppBody } from "@/lib/whatsapp-evidence";

export type EvidenceSnapshot = {
  mailId: string;
  sealedAt: unknown;
  sender: {
    uid: string;
    email: string;
    orgId: string | null;
    orgNombre: string | null;
    orgCuit: string | null;
  };
  recipient: {
    nombre: string;
    email: string;
    phone: string;
    dni: string;
    cuit?: string;
    legajo: string;
  };
  channel: string;
  subject: string;
  contentText: string;
  contentHash: string;
  attachments: Array<{ fileName: string; hash: string; fileSize: number }>;
  attachmentHashes: string[];
  whatsapp: {
    templateName: string | null;
    templateLang: string | null;
    templateVariables: string[] | null;
    requestSnapshot: unknown;
    bodyHash: string | null;
    wamid: string | null;
  };
  smtp: {
    messageId: string | null;
    accepted: unknown;
  };
  snapshotHash: string;
  campaignId: string | null;
  campaignMessageId: string | null;
};

function str(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

/** Copia lacrada del expediente ya sellado. Nunca reconstruye desde el mail vivo. */
async function persistSealedArtifacts(mailId: string, snapshot: EvidenceSnapshot): Promise<void> {
  await writeWormSnapshot(mailId, snapshot);
  await persistConstanciaEnvio(mailId, snapshot);
}

function attachmentList(mail: FirebaseFirestore.DocumentData) {
  const raw = mail.attachments;
  const list = Array.isArray(raw) ? raw : raw && typeof raw === "object" ? Object.values(raw) : [];
  return (list as Array<Record<string, unknown>>).map((a) => ({
    fileName: str(a.fileName || a.nombre || a.name),
    hash: str(a.hash),
    fileSize: typeof a.fileSize === "number" ? a.fileSize : Number(a.size || 0),
  }));
}

export function buildSnapshotCanonicalPayload(input: {
  mailId: string;
  senderUid: string;
  senderEmail: string;
  orgCuit: string;
  recipientEmail: string;
  recipientPhone: string;
  recipientDni: string;
  subject: string;
  contentHash: string;
  attachmentHashes: string[];
  waBodyHash: string;
  smtpMessageId: string;
  wamid: string;
}): string {
  const att = [...input.attachmentHashes].filter(Boolean).sort().join(",");
  return [
    "v1",
    "snap",
    input.mailId,
    input.senderUid,
    input.senderEmail.trim().toLowerCase(),
    input.orgCuit.replace(/\D/g, ""),
    input.recipientEmail.trim().toLowerCase(),
    input.recipientPhone.replace(/\D/g, ""),
    input.recipientDni.replace(/\D/g, ""),
    input.subject.trim(),
    input.contentHash,
    att,
    input.waBodyHash,
    input.smtpMessageId,
    input.wamid,
  ].join("|");
}


/**
 * Sella una vez el expediente del envío. Idempotente: si ya existe, no pisa.
 * Solo Admin SDK (las reglas niegan escritura al cliente).
 */
export async function sealEvidenceSnapshot(mailId: string): Promise<EvidenceSnapshot | null> {
  const db = getAdminDb();
  const snapRef = db.collection("evidence_snapshots").doc(mailId);
  const existing = await snapRef.get();
  if (existing.exists) {
    const sealedExisting = existing.data() as EvidenceSnapshot;
    await persistSealedArtifacts(mailId, sealedExisting).catch((e) =>
      console.warn("⚠️ WORM / constancia (ya sellado):", e instanceof Error ? e.message : e)
    );
    return sealedExisting;
  }

  const mailSnap = await db.collection("mail").doc(mailId).get();
  if (!mailSnap.exists) return null;
  const mail = mailSnap.data()!;

  if (mail.contactRequest === true) return null;

  let orgNombre: string | null = null;
  let orgCuit: string | null = null;
  let orgId: string | null = null;
  const campaignId = str(mail.campaignId) || null;
  if (campaignId) {
    const camp = await db.collection("campaigns").doc(campaignId).get();
    orgId = camp.exists ? str(camp.data()?.orgId) || null : null;
    if (orgId) {
      const org = await db.collection("organizations").doc(orgId).get();
      if (org.exists) {
        orgNombre = str(org.data()?.nombre) || null;
        orgCuit = str(org.data()?.cuit) || null;
      }
    }
  }

  const contentText = str(mail.message?.contentText || mail.message?.text || "");
  const contentHash = await computeContentHash(contentText);
  const attachments = attachmentList(mail);
  const attachmentHashes = attachments.map((a) => a.hash).filter(Boolean);
  const waBodyHash = await hashWhatsAppBody(mail.waRequestSnapshot);
  const smtpMessageId = str(mail.smtpMessageId || mail.delivery?.info || mail.tracking?.messageId);
  const wamid = str(mail.whatsappMessageId || mail.tracking?.whatsappMessageId);
  const senderEmail = str(mail.senderName || mail.replyTo || mail.from);
  const senderUid = str(mail.createdBy);
  const recipientEmail = str(mail.recipientEmail || (Array.isArray(mail.to) ? mail.to[0] : mail.to));
  const recipientPhone = str(mail.recipientPhone);
  const recipientDni = str(mail.recipientDni);
  const subject = str(mail.message?.subject);

  const canonical = buildSnapshotCanonicalPayload({
    mailId,
    senderUid,
    senderEmail,
    orgCuit: orgCuit || "",
    recipientEmail,
    recipientPhone,
    recipientDni,
    subject,
    contentHash,
    attachmentHashes,
    waBodyHash,
    smtpMessageId,
    wamid,
  });
  const snapshotHash = await sha256Hex(canonical);

  const record: Omit<EvidenceSnapshot, "sealedAt"> & { sealedAt: FirebaseFirestore.FieldValue; canonical: string } = {
    mailId,
    sealedAt: FieldValue.serverTimestamp(),
    sender: {
      uid: senderUid,
      email: senderEmail,
      orgId,
      orgNombre,
      orgCuit,
    },
    recipient: {
      nombre: str(mail.recipientName),
      email: recipientEmail,
      phone: recipientPhone,
      dni: recipientDni,
      cuit: str(mail.recipientCuit).replace(/\D/g, ""),
      legajo: str(mail.recipientLegajo),
    },
    channel: mail.waOnly ? "whatsapp" : recipientPhone ? "ambos" : "email",
    subject,
    contentText,
    contentHash,
    attachments,
    attachmentHashes,
    whatsapp: {
      templateName: mail.waTemplateName || null,
      templateLang: mail.waTemplateLang || null,
      templateVariables: Array.isArray(mail.waTemplateVariables) ? mail.waTemplateVariables : null,
      requestSnapshot: mail.waRequestSnapshot || null,
      bodyHash: waBodyHash || null,
      wamid: wamid || null,
    },
    smtp: {
      messageId: smtpMessageId || null,
      accepted: mail.smtpAccepted || null,
    },
    snapshotHash,
    canonical,
    campaignId,
    campaignMessageId: str(mail.campaignMessageId) || null,
  };

  let created = false;
  await db.runTransaction(async (t) => {
    const again = await t.get(snapRef);
    if (again.exists) return;
    t.set(snapRef, record);
    t.update(db.collection("mail").doc(mailId), {
      evidenceSealed: true,
      evidenceSnapshotHash: snapshotHash,
      "polygonCertifications.contentHash": contentHash,
      "polygonCertifications.updatedAt": new Date(),
    });
    created = true;
  });

  if (created && smtpMessageId) {
    await recordProviderEvent({
      mailId,
      campaignId,
      campaignMessageId: str(mail.campaignMessageId) || null,
      provider: "smtp",
      eventType: "accepted",
      providerMessageId: smtpMessageId,
      recipient: recipientEmail,
      raw: mail.smtpAccepted || { messageId: smtpMessageId },
    }).catch(() => undefined);
  }

  const sealed = created
    ? ({ ...record, sealedAt: new Date() } as EvidenceSnapshot)
    : ((await snapRef.get()).data() as EvidenceSnapshot | undefined) ?? null;
  if (sealed) {
    await persistSealedArtifacts(mailId, sealed).catch((e) =>
      console.warn("⚠️ WORM / constancia:", e instanceof Error ? e.message : e)
    );
  }
  return sealed;
}

export async function getEvidenceSnapshot(mailId: string): Promise<EvidenceSnapshot | null> {
  const snap = await getAdminDb().collection("evidence_snapshots").doc(mailId).get();
  if (!snap.exists) return null;
  const data = snap.data() as EvidenceSnapshot;
  // Primera escritura gana. Copia el expediente ya sellado; no reconstruye desde mail.
  await persistSealedArtifacts(mailId, data).catch((e) =>
    console.warn("⚠️ WORM / constancia (lectura):", e instanceof Error ? e.message : e)
  );
  return data;
}
