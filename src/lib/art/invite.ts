import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { ART_COLLECTIONS } from "@/lib/art/collections";
import { hashArtSecret, invitationTtlMs, newArtSecret } from "@/lib/art/tokens";
import { appendArtAuditEvent } from "@/lib/art/audit";
import { sendArtTransactionalEmail } from "@/lib/art/transactional-mail";
import type { ArtRecipient } from "@/lib/art/types";
import { publicAppBase } from "@/lib/public-verify-url";
import { assertPilotRecipientAllowed, throwArtCode } from "@/lib/art/pilot";

function appBase(): string {
  const raw = (process.env.NEXT_PUBLIC_APP_URL || "").trim().replace(/\/$/, "");
  if (raw) return raw;
  try {
    return publicAppBase();
  } catch {
    return "https://notificas.com.ar";
  }
}

export function adhesionInviteUrl(token: string): string {
  return `${appBase()}/adherir/${encodeURIComponent(token)}`;
}

export function adhesionManageUrl(token: string): string {
  return `${appBase()}/adhesion/manage/${encodeURIComponent(token)}`;
}

export async function createInvitation(input: {
  orgId: string;
  orgName: string;
  recipient: ArtRecipient;
  actor: string;
  send: boolean;
}): Promise<{ token: string; expiresAt: string; url: string }> {
  if (input.send) {
    throwArtCode(
      assertPilotRecipientAllowed({
        orgId: input.orgId,
        email: input.recipient.email,
        phone: input.recipient.phone,
      })
    );
  }
  const db = getAdminDb();
  const token = newArtSecret(32);
  const tokenHash = hashArtSecret(token);
  const expiresAt = new Date(Date.now() + invitationTtlMs()).toISOString();
  await db.collection(ART_COLLECTIONS.invitations).doc(tokenHash).set({
    tokenHash,
    orgId: input.orgId,
    recipientId: input.recipient.id,
    expiresAt,
    consumed: false,
    createdAt: FieldValue.serverTimestamp(),
  });
  await appendArtAuditEvent({
    orgId: input.orgId,
    recipientId: input.recipient.id,
    type: "INVITATION_CREATED",
    actor: input.actor,
    source: "art",
    metadata: { expiresAt },
  });
  const url = adhesionInviteUrl(token);
  if (input.send && input.recipient.email) {
    const sent = await sendArtTransactionalEmail({
      to: input.recipient.email,
      subject: `${input.orgName}: adhesión a notificaciones electrónicas`,
      text: [
        `Hola ${input.recipient.fullName || ""}.`.trim(),
        "",
        `${input.orgName} te invita a adherirte de forma voluntaria al sistema de notificaciones electrónicas.`,
        "Podrás revocar la adhesión más adelante.",
        "",
        `Ingresá al enlace (vence el ${expiresAt}):`,
        url,
        "",
        "Notificas",
      ].join("\n"),
    });
    await appendArtAuditEvent({
      orgId: input.orgId,
      recipientId: input.recipient.id,
      type: "INVITATION_SENT",
      actor: input.actor,
      source: "art",
      metadata: { channel: "email", skipped: sent.skipped === true, ok: sent.ok },
    });
  }
  return { token, expiresAt, url };
}

export async function resolveInvitation(token: string): Promise<{
  orgId: string;
  recipientId: string;
  expiresAt: string;
  consumed: boolean;
  tokenHash: string;
} | null> {
  if (!token || token.length < 16) return null;
  const tokenHash = hashArtSecret(token);
  const snap = await getAdminDb().collection(ART_COLLECTIONS.invitations).doc(tokenHash).get();
  if (!snap.exists) return null;
  const d = snap.data()!;
  return {
    orgId: String(d.orgId),
    recipientId: String(d.recipientId),
    expiresAt: String(d.expiresAt || ""),
    consumed: d.consumed === true,
    tokenHash,
  };
}

export async function createManageToken(orgId: string, recipientId: string): Promise<string> {
  const token = newArtSecret(32);
  const tokenHash = hashArtSecret(token);
  await getAdminDb().collection(ART_COLLECTIONS.manageTokens).doc(tokenHash).set({
    tokenHash,
    orgId,
    recipientId,
    createdAt: FieldValue.serverTimestamp(),
  });
  return token;
}

export async function resolveManageToken(token: string): Promise<{ orgId: string; recipientId: string } | null> {
  if (!token || token.length < 16) return null;
  const snap = await getAdminDb().collection(ART_COLLECTIONS.manageTokens).doc(hashArtSecret(token)).get();
  if (!snap.exists) return null;
  const d = snap.data()!;
  return { orgId: String(d.orgId), recipientId: String(d.recipientId) };
}
