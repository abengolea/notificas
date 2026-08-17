import { getAdminDb } from "@/lib/firebase-admin";
import { computeContentHash } from "@/lib/certification";
import { getTransactionInfo } from "@/lib/blockchain";
import { extractMerkleRootFromPayload, verifyCampaignMessage } from "@/lib/campaign-integrity";
import { getEvidenceSnapshot, sealEvidenceSnapshot } from "@/lib/evidence-snapshot";
import { listProviderEventsForMail } from "@/lib/provider-events";
import {
  extractWhatsAppHashFromPayload,
  hashWhatsAppBody,
  WHATSAPP_CHANNEL_DISCLAIMER,
} from "@/lib/whatsapp-evidence";

function extractContentHashFromSendPayload(payload: string | null): string | null {
  if (!payload) return null;
  const parts = payload.split("|");
  if (parts[0] !== "SEND") return null;
  const hash = parts.find((p) => /^[a-f0-9]{64}$/i.test(p));
  return hash ? hash.toLowerCase() : null;
}

function toIso(value: unknown): string | undefined {
  if (!value) return undefined;
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object" && value && "toDate" in value && typeof (value as { toDate: () => Date }).toDate === "function") {
    try {
      return (value as { toDate: () => Date }).toDate().toISOString();
    } catch {
      return undefined;
    }
  }
  return undefined;
}

export async function buildPublicEvidence(mailId: string) {
  const db = getAdminDb();
  const mailSnap = await db.collection("mail").doc(mailId).get();
  if (!mailSnap.exists) return null;
  const mail = mailSnap.data()!;

  let snapshot = await getEvidenceSnapshot(mailId);
  if (!snapshot && mail.delivery?.state === "DELIVERED" && mail.contactRequest !== true) {
    snapshot = await sealEvidenceSnapshot(mailId);
  }

  const liveText = String(mail.message?.contentText || mail.message?.text || "");
  const currentHash = await computeContentHash(liveText);
  const snapshotHash = snapshot?.contentHash || "";
  const firestoreHash = String(mail.polygonCertifications?.contentHash || snapshotHash || "");

  let onChainHash: string | null = null;
  let onChainMatch: boolean | null = null;
  const sendTx = mail.polygonCertifications?.send as string | undefined;
  if (typeof sendTx === "string" && sendTx.startsWith("0x")) {
    try {
      const info = await getTransactionInfo(sendTx);
      onChainHash = extractContentHashFromSendPayload(info?.data ?? null);
      onChainMatch = Boolean(onChainHash && (snapshotHash || firestoreHash) && onChainHash === (snapshotHash || firestoreHash));
    } catch {
      onChainMatch = null;
    }
  }

  const contentMatch = Boolean(firestoreHash) && currentHash === firestoreHash;
  const snapshotMatch = !snapshotHash || currentHash === snapshotHash;

  let campaign: Awaited<ReturnType<typeof verifyCampaignMessage>> | null = null;
  if (mail.campaignId && mail.campaignMessageId) {
    try {
      campaign = await verifyCampaignMessage(String(mail.campaignId), String(mail.campaignMessageId));
    } catch {
      campaign = null;
    }
  } else if (mail.campaignId) {
    const cm = await db.collection("campaign_messages").where("mailId", "==", mailId).limit(1).get();
    if (!cm.empty) {
      try {
        campaign = await verifyCampaignMessage(String(mail.campaignId), cm.docs[0].id);
      } catch {
        campaign = null;
      }
    }
  }

  const events = await listProviderEventsForMail(mailId, 15).catch(() => []);

  const currentWaHash = await hashWhatsAppBody(mail.waRequestSnapshot || snapshot?.whatsapp.requestSnapshot);
  const storedWaHash = String(
    mail.polygonCertifications?.waBodyHash || snapshot?.whatsapp.bodyHash || campaign?.send?.waBodyHash || ""
  );
  const waMatch = !storedWaHash || !currentWaHash || currentWaHash === storedWaHash;

  let waOnChainHash: string | null = null;
  let waOnChainMatch: boolean | null = null;
  const waTx = mail.polygonCertifications?.whatsapp as string | undefined;
  if (typeof waTx === "string" && waTx.startsWith("0x")) {
    try {
      const info = await getTransactionInfo(waTx);
      waOnChainHash = extractWhatsAppHashFromPayload(info?.data ?? null);
      waOnChainMatch = Boolean(waOnChainHash && storedWaHash && waOnChainHash === storedWaHash);
    } catch {
      waOnChainMatch = null;
    }
  }

  const intact =
    contentMatch &&
    snapshotMatch &&
    onChainMatch !== false &&
    waMatch &&
    waOnChainMatch !== false &&
    (campaign ? campaign.intact : true);

  return {
    docId: mailId,
    messageId: mail.tracking?.messageId || mailId,
    senderName: snapshot?.sender.email || mail.senderName || mail.from,
    senderUid: snapshot?.sender.uid || mail.createdBy || null,
    orgNombre: snapshot?.sender.orgNombre || null,
    orgCuit: snapshot?.sender.orgCuit || null,
    recipientEmail: snapshot?.recipient.email || mail.recipientEmail || mail.to?.[0],
    recipientNombre: snapshot?.recipient.nombre || mail.recipientName || null,
    recipientDni: snapshot?.recipient.dni || mail.recipientDni || null,
    recipientPhone: snapshot?.recipient.phone || mail.recipientPhone || null,
    subject: snapshot?.subject || mail.message?.subject || null,
    sentAt:
      toIso(mail.delivery?.time) ||
      toIso(mail.tracking?.sentAt) ||
      toIso(mail.createdAt),
    smtpMessageId: snapshot?.smtp.messageId || mail.smtpMessageId || mail.delivery?.info || null,
    wamid: snapshot?.whatsapp.wamid || mail.whatsappMessageId || mail.tracking?.whatsappMessageId || null,
    waBodyHash: {
      current: currentWaHash || null,
      stored: storedWaHash || null,
      onChain: waOnChainHash,
      match: waMatch,
      onChainMatch: waOnChainMatch,
    },
    waTxHash: waTx || null,
    waExplorerUrl: typeof waTx === "string" && waTx.startsWith("0x")
      ? `https://polygonscan.com/tx/${waTx}`
      : null,
    whatsappRole: currentWaHash || storedWaHash || mail.whatsappMessageId
      ? WHATSAPP_CHANNEL_DISCLAIMER
      : null,
    snapshotHash: snapshot?.snapshotHash || mail.evidenceSnapshotHash || null,
    contentHash: {
      current: currentHash,
      stored: firestoreHash || null,
      snapshot: snapshotHash || null,
      onChain: onChainHash,
      match: contentMatch,
      snapshotMatch,
      onChainMatch,
    },
    sendTxHash: sendTx || campaign?.send.txHash || null,
    merkleRoot: campaign?.send.merkleRoot || null,
    explorerUrl: sendTx
      ? `https://polygonscan.com/tx/${sendTx}`
      : campaign?.send.txHash
        ? `https://polygonscan.com/tx/${campaign.send.txHash}`
        : null,
    blockchainVerified: Boolean(sendTx || campaign?.send.txHash || waTx),
    intact,
    campaign,
    providerEvents: events.map((e) => ({
      id: e.id,
      provider: (e as { provider?: string }).provider,
      eventType: (e as { eventType?: string }).eventType,
      providerTimestamp: (e as { providerTimestamp?: string }).providerTimestamp,
      providerMessageId: (e as { providerMessageId?: string }).providerMessageId,
    })),
    summary: intact
      ? "El texto intimado (correo/lector) coincide con el snapshot. Si hubo WhatsApp, el aviso (template + enlace) se ancla aparte."
      : "Hay una diferencia entre el texto intimado, el aviso de WhatsApp, el snapshot o Polygon.",
  };
}

export { extractMerkleRootFromPayload };
