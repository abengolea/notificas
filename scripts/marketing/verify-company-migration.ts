#!/usr/bin/env node
/**
 * Verificación de lectura de CRM_COMPANIES_V1. No escribe.
 */
import path from "path";
import { config } from "dotenv";

config({ path: path.join(process.cwd(), ".env.local") });

const EXPECTED: Record<string, number> = {
  "Camuzzi Gas": 4,
  Ecogas: 6,
  "Empresa Sur": 1,
  "Gas NEA": 2,
  "Gasnor / Naturgy NOA": 1,
  "Litoral Gas": 2,
  Metrogas: 5,
  Naturgy: 7,
  "Naturgy NOA": 2,
  Redengas: 1,
};

async function main() {
  const { getAdminDb } = await import("../../src/lib/firebase-admin");
  const { MARKETING_COMPANIES, MARKETING_CONTACTS, MARKETING_SOURCES } = await import(
    "../../src/lib/marketing/collections"
  );
  const { fromFirestoreDocument } = await import("../../src/lib/marketing/persistence/documents");
  const { DEFAULT_MARKETING_WORKSPACE_ID } = await import("../../src/lib/marketing/workspace");

  const db = getAdminDb();
  const companiesSnap = await db.collection(MARKETING_COMPANIES).get();
  const contactsSnap = await db.collection(MARKETING_CONTACTS).get();
  const sourcesSnap = await db.collection(MARKETING_SOURCES).get();

  const companies = companiesSnap.docs.map((d) => fromFirestoreDocument(d.id, d.data()));
  const contacts = contactsSnap.docs.map((d) => fromFirestoreDocument(d.id, d.data()));
  const sources = sourcesSnap.docs.map((d) => fromFirestoreDocument(d.id, d.data()));

  const wsCompanies = companies.filter((c) => c.workspaceId === DEFAULT_MARKETING_WORKSPACE_ID);
  const otherCompanies = companies.filter((c) => c.workspaceId !== DEFAULT_MARKETING_WORKSPACE_ID);

  console.log(JSON.stringify({
    project: process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    companiesTotal: companies.length,
    companiesWorkspace: wsCompanies.length,
    companiesOtherWorkspace: otherCompanies.length,
    companies: wsCompanies.map((c) => ({
      id: c.id,
      name: c.name,
      normalizedName: c.normalizedName,
      countryCode: c.countryCode,
      workspaceId: c.workspaceId,
      status: c.status,
      deletedAt: c.deletedAt ?? null,
      website: c.website ?? null,
      normalizedDomain: c.normalizedDomain ?? null,
      sourceIds: c.sourceIds,
      createdBy: c.createdBy ?? null,
      createdAt: c.createdAt,
    })),
    sources: sources.map((s) => ({
      id: s.id,
      name: s.name,
      type: s.type,
      workspaceId: s.workspaceId,
      metadata: s.metadata ?? null,
    })),
    contacts: contacts.map((c) => ({
      id: c.id,
      company: c.company,
      companyId: c.companyId ?? null,
      workspaceId: c.workspaceId || DEFAULT_MARKETING_WORKSPACE_ID,
      country: c.country,
      emailDomain: String(c.email || "").split("@")[1] || null,
    })),
  }, null, 2));

  const byCompany = new Map<string, typeof contacts>();
  for (const contact of contacts) {
    const id = String(contact.companyId || "");
    if (!id) continue;
    const list = byCompany.get(id) || [];
    list.push(contact);
    byCompany.set(id, list);
  }

  console.error("TABLE");
  for (const [name, expected] of Object.entries(EXPECTED)) {
    const company = wsCompanies.find((c) => c.name === name);
    const linked = company ? (byCompany.get(String(company.id)) || []).length : 0;
    console.error(
      `${name.padEnd(24)} ${company ? String(company.id).slice(0, 8) : "MISSING"} ${String(company?.countryCode || "").padEnd(2)} ${linked}/${expected} ${
        company && !company.deletedAt && linked === expected ? "OK" : "FAIL"
      }`,
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
