/**
 * Dry-run (default) for notes already stored as LinkedIn research.
 * Does not delete notes. Apply only with --apply after reviewing the plan.
 *
 *   npx tsx scripts/marketing/migrate-linkedin-notes.ts
 *   npx tsx scripts/marketing/migrate-linkedin-notes.ts --apply
 */
import path from "path";
import { config } from "dotenv";
import { getAdminDb } from "../../src/lib/firebase-admin";
import {
  MARKETING_ACTIVITIES,
  MARKETING_COMPANIES,
  MARKETING_CONTACTS,
} from "../../src/lib/marketing/collections";
import { normalizeLinkedInUrl } from "../../src/lib/marketing/normalizers";
import { DEFAULT_MARKETING_WORKSPACE_ID } from "../../src/lib/marketing/workspace";

config({ path: path.join(process.cwd(), ".env.local") });

const APPLY = process.argv.includes("--apply");

const SEEDS = [
  { company: "Tigo Panamá", people: ["Federico Cosp", "Lisania Barria"] },
  { company: "Óptima", people: ["Jennifer Gisselle Portillo", "Francisco Arce"] },
  { company: "AES El Salvador", people: ["David Alvarenga", "Carlos Guardado"] },
  { company: "Claro Costa Rica", people: ["Marcelo Mouzo", "Melania Cook"] },
];

const LINKEDIN_RE = /https?:\/\/(?:[\w-]+\.)?linkedin\.com\/in\/[^\s)"']+/gi;

function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

async function main() {
  const db = getAdminDb();
  const workspaceId = DEFAULT_MARKETING_WORKSPACE_ID;
  const companies = await db.collection(MARKETING_COMPANIES).where("workspaceId", "==", workspaceId).get();
  const activities = await db.collection(MARKETING_ACTIVITIES).where("workspaceId", "==", workspaceId).get();
  const contacts = await db.collection(MARKETING_CONTACTS).where("workspaceId", "==", workspaceId).limit(2000).get();

  console.log(`workspace=${workspaceId} apply=${APPLY}`);
  console.log("This script never deletes notes. Review the plan before --apply.");

  for (const seed of SEEDS) {
    const company = companies.docs.find((doc) => fold(String(doc.data().name || "")).includes(fold(seed.company)));
    console.log(`\n## ${seed.company}`);
    if (!company) {
      console.log("  company not found; skip");
      continue;
    }
    const notes = activities.docs.filter((doc) => {
      const data = doc.data();
      return data.companyId === company.id && /linkedin\.com\/in\//i.test(String(data.description || data.title || data.text || ""));
    });
    console.log(`  companyId=${company.id} linkedin_notes=${notes.length}`);
    for (const person of seed.people) {
      const related = notes.filter((doc) => fold(String(doc.data().description || doc.data().title || "")).includes(fold(person)));
      const urls = [...new Set(related.flatMap((doc) => String(doc.data().description || "").match(LINKEDIN_RE) || []))];
      const normalized = urls.map((url) => normalizeLinkedInUrl(url)).filter(Boolean);
      const existing = contacts.docs.find((doc) => {
        const data = doc.data();
        return fold(String(data.name || "")).includes(fold(person)) || normalized.includes(String(data.linkedinUrl || ""));
      });
      console.log(`  - ${person}: urls=${normalized.join(", ") || "none"} contact=${existing?.id || "missing"}`);
      if (!APPLY || !normalized[0]) continue;
      if (existing) {
        if (!existing.data().linkedinUrl) {
          await existing.ref.set({ linkedinUrl: normalized[0], updatedAt: new Date().toISOString() }, { merge: true });
          console.log(`    updated contact ${existing.id} linkedinUrl`);
        }
      } else {
        const ref = db.collection(MARKETING_CONTACTS).doc();
        await ref.set({
          workspaceId,
          name: person,
          email: "",
          linkedinUrl: normalized[0],
          companyId: company.id,
          company: String(company.data().name || seed.company),
          prospectingSource: "linkedin",
          linkedinStatus: "not_contacted",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        console.log(`    created contact ${ref.id}`);
      }
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
