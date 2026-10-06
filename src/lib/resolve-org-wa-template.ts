import { getAdminDb } from "@/lib/firebase-admin";
import { mapSavedWaTemplate, pickPreferredOrgWaTemplate } from "@/lib/wa-saved-template";
import type { SavedWaTemplate } from "@/lib/types";

export { pickPreferredOrgWaTemplate };

export async function resolvePreferredOrgWaTemplate(orgId: string): Promise<SavedWaTemplate | null> {
  const id = String(orgId || "").trim();
  if (!id) return null;
  const snap = await getAdminDb().collection("wa_templates").where("orgId", "==", id).get();
  const list = snap.docs.map((d) => mapSavedWaTemplate(d.id, d.data() as Record<string, unknown>));
  return pickPreferredOrgWaTemplate(list);
}
