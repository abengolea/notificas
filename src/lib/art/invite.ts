import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { ART_COLLECTIONS } from "@/lib/art/collections";
import { hashArtSecret, invitationTtlMs, newArtSecret } from "@/lib/art/tokens";
import { appendArtAuditEvent } from "@/lib/art/audit";
import { sendArtTransactionalEmail } from "@/lib/art/transactional-mail";
import { buildSystemEmailHtml } from "@/lib/email-template";
import { getEmailActionOrigin } from "@/lib/send-account-setup-email";
import type { ArtRecipient } from "@/lib/art/types";
import { publicAppBase } from "@/lib/public-verify-url";
import { assertPilotRecipientAllowed, throwArtCode } from "@/lib/art/pilot";

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function notificasLogoUrl(): string {
  return `${getEmailActionOrigin()}/notificasLogo.jpg`;
}

function formatInviteExpiry(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" });
}

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

export function adhesionConfirmationEmail(input: {
  orgName: string;
  fullName?: string | null;
  adhesionId: string;
  manageUrl: string;
  recipientEmail: string;
  logoUrl?: string | null;
}): { subject: string; text: string; html: string } {
  const name = String(input.fullName || "").trim();
  const greeting = name ? `Hola ${name},` : "Hola,";
  const subject = `${input.orgName}: tu adhesión quedó registrada`;
  const org = String(input.orgName || "tu organización").trim();
  const text = [
    greeting,
    "",
    `Tu adhesión voluntaria a las notificaciones electrónicas de ${org} quedó registrada.`,
    `Constancia: ${input.adhesionId}`,
    "",
    "Para consultar el estado, descargar la constancia o revocar la adhesión:",
    input.manageUrl,
    "",
    "Guardá este correo: con este enlace podés administrar o revocar la adhesión.",
    "",
    "Notificas.com",
  ].join("\n");
  const html = buildSystemEmailHtml({
    badge: "ADHESIÓN",
    title: "Tu adhesión quedó registrada",
    subtitle: `Registro en <strong>${escapeHtml(org)}</strong> mediante <strong>Notificas.com</strong>`,
    preheader: `Adhesión registrada. Conservá el enlace para administrar o revocar.`,
    recipientEmail: String(input.recipientEmail || "").trim().toLowerCase(),
    logoUrl: input.logoUrl,
    bodyHtml: `
              <p class="lead">${escapeHtml(greeting)}</p>
              <p class="lead">Tu adhesión voluntaria a las notificaciones electrónicas de <strong>${escapeHtml(org)}</strong> quedó registrada.</p>
              <p class="lead">Constancia: <strong>${escapeHtml(input.adhesionId)}</strong></p>
              <p class="lead">Con el botón siguiente podés consultar el estado, descargar la constancia o <strong>revocar</strong> la adhesión. Guardá este correo.</p>
    `.trim(),
    ctaLabel: "Administrar o revocar",
    ctaHref: input.manageUrl,
  });
  return { subject, text, html };
}

export function adhesionInviteEmail(input: {
  orgName: string;
  fullName?: string | null;
  inviteUrl: string;
  expiresAt: string;
  recipientEmail: string;
  logoUrl?: string | null;
}): { subject: string; text: string; html: string } {
  const name = String(input.fullName || "").trim();
  const greeting = name ? `Hola ${name},` : "Hola,";
  const org = String(input.orgName || "tu organización").trim();
  const expiresLabel = formatInviteExpiry(input.expiresAt);
  const subject = `${org}: adhesión a notificaciones electrónicas`;
  const text = [
    greeting,
    "",
    `${org} te invita a adherirte de forma voluntaria al sistema de notificaciones electrónicas.`,
    "Podrás revocar la adhesión más adelante.",
    "",
    `1. Abrí este enlace de verificación (vence el ${expiresLabel}):`,
    input.inviteUrl,
    "2. Confirmá tus datos.",
    "3. Te va a llegar un código por WhatsApp: cargalo en esa misma página para validar tu número.",
    "",
    "Notificas.com",
  ].join("\n");
  const html = buildSystemEmailHtml({
    badge: "ADHESIÓN",
    title: "Te invitamos a adherirte",
    subtitle: `Invitación de <strong>${escapeHtml(org)}</strong> mediante <strong>Notificas.com</strong>`,
    preheader: `${org} te invita a adherirte a notificaciones electrónicas.`,
    recipientEmail: String(input.recipientEmail || "").trim().toLowerCase(),
    logoUrl: input.logoUrl,
    bodyHtml: `
              <p class="lead">${escapeHtml(greeting)}</p>
              <p class="lead"><strong>${escapeHtml(org)}</strong> te invita a adherirte de forma voluntaria a las notificaciones electrónicas. Podrás revocar la adhesión más adelante.</p>
              <p class="lead">El enlace vence el <strong>${escapeHtml(expiresLabel)}</strong>. Abrilo, confirmá tus datos y cargá el código que te llega por WhatsApp en esa misma página.</p>
    `.trim(),
    ctaLabel: "Abrir invitación",
    ctaHref: input.inviteUrl,
  });
  return { subject, text, html };
}

export async function sendAdhesionConfirmationEmail(input: {
  orgId: string;
  orgName: string;
  recipient: ArtRecipient;
  adhesionId: string;
  manageToken: string;
}): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  const email = String(input.recipient.email || "").trim();
  if (!email) return { ok: false, error: "email_required" };
  const copy = adhesionConfirmationEmail({
    orgName: input.orgName,
    fullName: input.recipient.fullName,
    adhesionId: input.adhesionId,
    manageUrl: adhesionManageUrl(input.manageToken),
    recipientEmail: email,
    logoUrl: notificasLogoUrl(),
  });
  const sent = await sendArtTransactionalEmail({
    to: email,
    subject: copy.subject,
    text: copy.text,
    html: copy.html,
  });
  if (!sent.ok) {
    console.warn("[art] confirmation email failed", { orgId: input.orgId, error: sent.error });
  }
  return sent;
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
    const copy = adhesionInviteEmail({
      orgName: input.orgName,
      fullName: input.recipient.fullName,
      inviteUrl: url,
      expiresAt,
      recipientEmail: input.recipient.email,
      logoUrl: notificasLogoUrl(),
    });
    const sent = await sendArtTransactionalEmail({
      to: input.recipient.email,
      subject: copy.subject,
      text: copy.text,
      html: copy.html,
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
