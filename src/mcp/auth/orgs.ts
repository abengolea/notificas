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
