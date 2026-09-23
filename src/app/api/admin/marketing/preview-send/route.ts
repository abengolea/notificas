import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { assertAdminSession } from "@/lib/assert-admin-session";
import { getAdminDb } from "@/lib/firebase-admin";
import { contactIdForEmail, isValidEmail, normalizeEmail } from "@/lib/marketing/csv";
import { MARKETING_CAMPAIGNS, MARKETING_CONTACTS, MARKETING_SENDS } from "@/lib/marketing/collections";
import { campaignEmailContentSchema } from "@/lib/marketing/campaign-email-input";
import { persistCampaignEmail, PREVIEW_MERGE_FIELDS } from "@/lib/marketing/campaign-email";
import { assembleMarketingHtml } from "@/lib/marketing/html";
import { sendMarketingEmailViaResend } from "@/lib/marketing/send";
import { marketingTestEmail } from "@/lib/marketing/types";

const postSchema = z.object({
  to: z.string().email().optional(),
  subject: z.string().min(2).max(200),
  campaignId: z.string().max(80).optional(),
  emailContent: campaignEmailContentSchema,
});

export async function GET(request: NextRequest) {
  const denied = assertAdminSession(request);
  if (denied) return denied;
  return NextResponse.json({ to: marketingTestEmail(), sent: false });
}

export async function POST(request: NextRequest) {
  const denied = assertAdminSession(request);
  if (denied) return denied;
  try {
    const parsed = postSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const to = normalizeEmail(parsed.data.to || marketingTestEmail());
    if (!isValidEmail(to)) {
      return NextResponse.json({ error: "Email de prueba inválido" }, { status: 400 });
    }
    const db = getAdminDb();
    let persistInput: Parameters<typeof persistCampaignEmail>[0] = {
      ...parsed.data.emailContent,
      campaignName: parsed.data.emailContent.campaignName || "",
      subject: parsed.data.subject,
    };
    if (parsed.data.campaignId) {
      const campSnap = await db.collection(MARKETING_CAMPAIGNS).doc(parsed.data.campaignId).get();
      if (campSnap.exists) {
        const camp = campSnap.data() || {};
        persistInput = {
          ...persistInput,
          htmlBody: String(camp.htmlBody || ""),
          name: String(camp.name || ""),
          campaignName: persistInput.campaignName || String(camp.name || ""),
          title: persistInput.title || String(camp.subject || parsed.data.subject),
        };
      }
    }
    const snapshot = persistCampaignEmail(persistInput);
    const contactId = contactIdForEmail(to);
    const sendRef = db.collection(MARKETING_SENDS).doc();
    const now = new Date().toISOString();
    const fields: Record<string, string> = {
      ...PREVIEW_MERGE_FIELDS,
      email: to,
    };
    await db.collection(MARKETING_CONTACTS).doc(contactId).set(
      {
        email: to,
        emailKey: to,
        name: fields.fullName,
        company: fields.companyName,
        title: fields.jobTitle,
        country: "AR",
        notes: "Envío de prueba de campaña comercial",
        tags: ["test-send"],
        listIds: [],
        stage: "sent",
        stageManual: false,
        source: "manual",
        lastCampaignId: parsed.data.campaignId || null,
        lastSendId: sendRef.id,
        lastSentAt: now,
        updatedAt: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    const assembled = assembleMarketingHtml({
      bodyHtml: snapshot.htmlBody,
      textBody: snapshot.textBody,
      sendId: sendRef.id,
      contactId,
      fields,
      trackLinks: false,
    });
    const result = await sendMarketingEmailViaResend({
      to,
      subject: parsed.data.subject,
      html: assembled.html,
      text: assembled.text,
      sendId: sendRef.id,
      contactId,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error, sent: false }, { status: 502 });
    }
    await sendRef.set({
      campaignId: parsed.data.campaignId || "",
      contactId,
      email: to,
      country: "AR",
      company: fields.companyName,
      name: fields.fullName,
      subject: parsed.data.subject,
      status: "sent",
      testSend: true,
      resendEmailId: result.emailId || null,
      rfcMessageId: result.messageId || null,
      gmailThreadId: null,
      gmailMessageId: null,
      openCount: 0,
      clickCount: 0,
      replySnippet: null,
      lastError: null,
      sentAt: now,
      deliveredAt: null,
      openedAt: null,
      clickedAt: null,
      repliedAt: null,
      bouncedAt: null,
      createdAt: FieldValue.serverTimestamp(),
    });
    return NextResponse.json({
      sent: true,
      test: true,
      campaignSent: false,
      to,
      emailId: result.emailId,
    });
  } catch (e) {
    console.error("POST marketing preview-send", e);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
