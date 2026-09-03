import { NextRequest } from "next/server";
import { hasAdminSession } from "@/lib/admin-session";
import { verifyAuthToken } from "@/lib/auth-helper";
import { getOrgIfMember } from "@/lib/org-server";
import { getAdminDb } from "@/lib/firebase-admin";
import { getEvidenceSnapshot } from "@/lib/evidence-snapshot";

/** Admin o miembro de la empresa / autor del envío. Denegar = 404, no 403. */
export async function canViewMail(request: NextRequest, mailId: string): Promise<boolean> {
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
