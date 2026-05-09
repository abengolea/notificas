import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase-admin';
import type { DocumentReference, DocumentData } from 'firebase-admin/firestore';

export type OrgRecord = DocumentData & {
  adminUserId?: string;
  adminUserEmail?: string;
  members?: string[];
  plan?: string;
};

/**
 * @param authEmail Email del JWT (opcional). Si coincide con `adminUserEmail` de la org.
 *  pero el `adminUserId` quedó desactualizado (p. ej. cuenta Auth recreada), se permite el acceso y se actualiza el doc.
 */
export async function getOrgIfMember(
  uid: string,
  orgId: string,
  authEmail?: string | null,
): Promise<{ ref: DocumentReference; data: OrgRecord } | null> {
  const db = getAdminDb();
  const ref = db.collection('organizations').doc(orgId);
  const snap = await ref.get();
  if (!snap.exists) return null;
  const data = snap.data() as OrgRecord;
  const members = Array.isArray(data.members) ? data.members : [];
  const emailNorm = authEmail?.trim().toLowerCase() ?? '';
  const adminEmail =
    typeof data.adminUserEmail === 'string' ? data.adminUserEmail.trim().toLowerCase() : '';
  const isAdminByVerifiedEmail = Boolean(emailNorm && adminEmail && emailNorm === adminEmail);

  const allowed =
    data.adminUserId === uid || members.includes(uid) || isAdminByVerifiedEmail;

  if (!allowed) return null;

  if (
    isAdminByVerifiedEmail &&
    (data.adminUserId !== uid || !members.includes(uid))
  ) {
    try {
      await ref.update({
        adminUserId: uid,
        members: FieldValue.arrayUnion(uid),
      });
    } catch (e) {
      console.error('getOrgIfMember: no se pudo alinear adminUserId/members', e);
    }
  }

  return { ref, data };
}

export { maxRecipientsForPlan } from '@/lib/org-limits-client';
