/**
 * Aplica la plantilla institucional a la campaña Vaca Muerta en borrador.
 * No envía la campaña.
 *
 *   npx tsx scripts/marketing/apply-institutional-template.ts
 */
import path from "path";
import { config } from "dotenv";
config({ path: path.join(process.cwd(), ".env.local") });
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "../../src/lib/firebase-admin";
import { MARKETING_CAMPAIGNS } from "../../src/lib/marketing/collections";
import { persistCampaignEmail, VACA_MUERTA_OILFIELD_CONTENT } from "../../src/lib/marketing/campaign-email";

const CAMPAIGN_ID = "jKO4Z30A7iHi6RDx4Z6n";
const SUBJECT = "Vaca Muerta: comunicaciones trazables para personal y contratistas";

async function main() {
  const db = getAdminDb();
  const ref = db.collection(MARKETING_CAMPAIGNS).doc(CAMPAIGN_ID);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new Error(`Campaña ${CAMPAIGN_ID} no encontrada`);
  }
  const current = snap.data() || {};
  const status = String(current.status || "draft");
  if (status !== "draft") {
    throw new Error(`La campaña no está en borrador (estado: ${status}). No se modifica ni se envía.`);
  }
  const snapshot = persistCampaignEmail({
    ...VACA_MUERTA_OILFIELD_CONTENT,
    campaignName: String(current.name || VACA_MUERTA_OILFIELD_CONTENT.campaignName),
  });
  await ref.update({
    subject: SUBJECT,
    htmlBody: snapshot.htmlBody,
    textBody: snapshot.textBody,
    emailContent: snapshot.emailContent,
    templateId: snapshot.templateId,
    templateVersion: snapshot.templateVersion,
    htmlSnapshotAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  const next = await ref.get();
  const data = next.data() || {};
  console.log("campaignId", CAMPAIGN_ID);
  console.log("status", data.status);
  console.log("subject", data.subject);
  console.log("templateId", data.templateId);
  console.log("htmlBytes", String(data.htmlBody || "").length);
  console.log("sent", false);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
