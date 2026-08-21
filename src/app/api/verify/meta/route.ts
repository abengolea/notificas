import { NextRequest, NextResponse } from "next/server";
import { hasAdminSession } from "@/lib/admin-session";
import { verifyAuthToken } from "@/lib/auth-helper";
import { getOrgIfMember } from "@/lib/org-server";
import { getAdminDb } from "@/lib/firebase-admin";
import { getEvidenceSnapshot } from "@/lib/evidence-snapshot";
import { buildMetaCommunicationReport } from "@/lib/meta-evidence-verification";
import { payloadContainsSecrets } from "@/lib/meta-graph-client";

const SECRET_KEY = /token|secret|authorization|password|cookie|bearer/i;

function stripSecrets<T>(value: T, depth = 0): T {
  if (depth > 10 || value == null) return value;
  if (Array.isArray(value)) return value.map((v) => stripSecrets(v, depth + 1)) as T;
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SECRET_KEY.test(k)) continue;
      out[k] = stripSecrets(v, depth + 1);
    }
    return out as T;
  }
  return value;
}

function wamidLookupKeys(wamid: string): string[] {
  const id = wamid.trim();
  if (!id) return [];
  const keys = [id];
  if (id.startsWith("wamid.")) keys.push(id.slice("wamid.".length));
  else keys.push(`wamid.${id}`);
  return [...new Set(keys)];
}

async function resolveMailId(input: { messageId?: string; campaignId?: string }): Promise<string | null> {
  const db = getAdminDb();
  const messageId = input.messageId?.trim();
  if (!messageId) return null;
  const mail = await db.collection("mail").doc(messageId).get();
  if (mail.exists) return mail.id;
  const cm = await db.collection("campaign_messages").doc(messageId).get();
  if (cm.exists) {
    const mailId = cm.data()?.mailId;
    if (typeof mailId === "string" && mailId) return mailId;
  }
  if (input.campaignId) {
    const byCamp = await db
      .collection("campaign_messages")
      .where("campaignId", "==", input.campaignId)
      .where("mailId", "==", messageId)
      .limit(1)
      .get();
    if (!byCamp.empty) {
      const mailId = byCamp.docs[0].data()?.mailId;
      if (typeof mailId === "string") return mailId;
    }
  }
  for (const key of wamidLookupKeys(messageId)) {
    const idDoc = await db.doc(`whatsapp_ids/${key}`).get();
    if (idDoc.exists) {
      const mailDocId = idDoc.data()?.mailDocId;
      if (typeof mailDocId === "string" && mailDocId) return mailDocId;
    }
  }
  for (const key of wamidLookupKeys(messageId)) {
    const byWamid = await db.collection("mail").where("whatsappMessageId", "==", key).limit(1).get();
    if (!byWamid.empty) return byWamid.docs[0].id;
    const byTracking = await db.collection("mail").where("tracking.whatsappMessageId", "==", key).limit(1).get();
    if (!byTracking.empty) return byTracking.docs[0].id;
  }
  return null;
}

async function canViewMail(request: NextRequest, mailId: string): Promise<boolean> {
  if (hasAdminSession(request)) return true;
  const { decoded, errorResponse } = await verifyAuthToken(request);
  if (errorResponse || !decoded) return false;
  const db = getAdminDb();
  const mailSnap = await db.collection("mail").doc(mailId).get();
  if (!mailSnap.exists) return false;
  const mail = mailSnap.data()!;
  if (String(mail.createdBy || "") === decoded.uid) return true;
  if (mail.campaignId) {
    const camp = await db.collection("campaigns").doc(String(mail.campaignId)).get();
    const orgId = camp.exists ? String(camp.data()?.orgId || "") : "";
    if (orgId) {
      const org = await getOrgIfMember(decoded.uid, orgId, decoded.email);
      if (org) return true;
    }
  }
  const snapshot = await getEvidenceSnapshot(mailId);
  if (snapshot?.sender.orgId) {
    const org = await getOrgIfMember(decoded.uid, snapshot.sender.orgId, decoded.email);
    if (org) return true;
  }
  return false;
}

/**
 * Validación de comunicación WhatsApp / Meta. Solo usuarios autenticados
 * con acceso al envío. Nunca expone Access Token ni App Secret.
 */
export async function POST(request: NextRequest) {
  try {
    const admin = hasAdminSession(request);
    if (!admin) {
      const { errorResponse } = await verifyAuthToken(request);
      if (errorResponse) return errorResponse;
    }

    const body = await request.json().catch(() => ({}));
    const messageId = typeof body?.messageId === "string" ? body.messageId.trim() : "";
    const campaignId = typeof body?.campaignId === "string" ? body.campaignId.trim() : "";
    const refresh = body?.refresh === true;
    if (!messageId) {
      return NextResponse.json({ error: "messageId requerido" }, { status: 400 });
    }

    const mailId = await resolveMailId({ messageId, campaignId });
    if (!mailId) {
      return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    }
    const allowed = await canViewMail(request, mailId);
    if (!allowed) {
      return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    }

    const { decoded } = admin
      ? { decoded: null }
      : await verifyAuthToken(request);

    const report = await buildMetaCommunicationReport({
      mailId,
      refresh,
      uid: decoded?.uid ?? (admin ? "admin" : null),
    });
    if (!report) {
      return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    }

    const sanitized = stripSecrets(report);
    if (payloadContainsSecrets(sanitized)) {
      return NextResponse.json({ error: "Respuesta bloqueada por contenido sensible" }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: sanitized });
  } catch (e) {
    console.error("POST /api/verify/meta", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
