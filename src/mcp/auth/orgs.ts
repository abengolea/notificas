import { getAdminDb } from "@/lib/firebase-admin";
import { getOrgIfMember } from "@/lib/org-server";

export type McpOrgSummary = {
  id: string;
  nombre: string;
  plan: string;
  cuit: string | null;
};

export async function listOrgsForUser(uid: string, email?: string | null): Promise<McpOrgSummary[]> {
  const db = getAdminDb();
  const parts = [
    db.collection("organizations").where("adminUserId", "==", uid).get(),
    db.collection("organizations").where("members", "array-contains", uid).get(),
  ];
  const emailNorm = email?.trim().toLowerCase();
  if (emailNorm) {
    parts.push(db.collection("organizations").where("adminUserEmail", "==", emailNorm).get());
  }
  const snaps = await Promise.all(parts);
  const map = new Map<string, McpOrgSummary>();
  for (const q of snaps) {
    for (const d of q.docs) {
      const data = d.data();
      map.set(d.id, {
        id: d.id,
        nombre: String(data.nombre || ""),
        plan: String(data.plan || "starter"),
        cuit: typeof data.cuit === "string" ? data.cuit : null,
      });
    }
  }
  return [...map.values()];
}

export async function listOrgsForAdminEmail(email: string | null | undefined): Promise<McpOrgSummary[]> {
  const emailNorm = email?.trim().toLowerCase();
  if (!emailNorm) return [];
  const db = getAdminDb();
  const snap = await db.collection("organizations").where("adminUserEmail", "==", emailNorm).get();
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      nombre: String(data.nombre || ""),
      plan: String(data.plan || "starter"),
      cuit: typeof data.cuit === "string" ? data.cuit : null,
    };
  });
}

/**
 * Resolve a product company for CRM OAuth without mutating adminUserId/members.
 * CRM consent authenticates as `admin:{email}`, which must not be written onto the org.
 */
export async function resolveOrgForCrmProductScopes(
  email: string | null | undefined,
  orgId: string,
) {
  const emailNorm = email?.trim().toLowerCase();
  if (!orgId || !emailNorm) return null;
  const db = getAdminDb();
  const ref = db.collection("organizations").doc(orgId);
  const snap = await ref.get();
  if (!snap.exists) return null;
  const data = snap.data() || {};
  const adminEmail =
    typeof data.adminUserEmail === "string" ? data.adminUserEmail.trim().toLowerCase() : "";
  if (adminEmail !== emailNorm) return null;
  return {
    id: snap.id,
    nombre: String(data.nombre || ""),
    plan: String(data.plan || "starter"),
    cuit: typeof data.cuit === "string" ? data.cuit : null,
    adminUserId: String(data.adminUserId || ""),
    adminUserEmail: String(data.adminUserEmail || email || ""),
  };
}

export async function resolveAuthorizedOrg(
  uid: string,
  email: string | null | undefined,
  orgId: string
) {
  const org = await getOrgIfMember(uid, orgId, email);
  if (!org) return null;
  return {
    id: org.ref.id,
    nombre: String(org.data.nombre || ""),
    plan: String(org.data.plan || "starter"),
    cuit: typeof org.data.cuit === "string" ? org.data.cuit : null,
    adminUserId: String(org.data.adminUserId || uid),
    adminUserEmail: String(org.data.adminUserEmail || email || ""),
  };
}
